import { prisma } from '@/modules/shared/prisma'
import { addRenderJob, renderQueue } from '@/modules/renderer/render-queue'
import { publishComposition } from '@/modules/publisher/publish-orchestrator'
import { checkAllTokens } from '@/modules/publisher/instagram-token'
import { acquireLock, releaseLock } from '@/modules/shared/rate-limit'
import { logger, logError } from '@/modules/shared/logger'
import { notifyTodayDigest, notifyNextInLine } from '@/modules/notifications/approval-notifications'

const USER_MANAGED_FORMATS = new Set(['head_talk', 'replicate'])
const RENDER_TIMEOUT_MS = 15 * 60 * 1000

async function runPublisher() {
  const now = new Date()
  const duePosts = await prisma.post.findMany({
    where: {
      status: { in: ['RENDERED_APPROVED', 'PUBLISHING', 'SCHEDULED'] },
      scheduledAt: { lte: now },
      publishAttempts: { lt: 3 },
    },
    include: {
      brand: { include: { socialProfiles: true } },
      template: { include: { brandConfigs: true } },
    },
  })

  let published = 0
  let failed = 0

  for (const post of duePosts) {
    const profile = post.brand?.socialProfiles?.[0]
    if (!profile?.accessToken || !profile?.platformId) continue

    // RENDERED_PENDING requires manual approval — never publish directly.
    if (post.status === 'RENDERED_PENDING') continue

    try {
      const result = await publishComposition({
        ...post,
        format: post.format ?? '',
        socialProfile: { ...profile, accessToken: profile.accessToken },
      })
      if (result.success) {
        published++
      } else {
        throw new Error(result.error || 'Unknown publish error')
      }
    } catch (err) {
      const attempts = post.publishAttempts + 1
      await prisma.post.update({
        where: { id: post.id },
        data: {
          publishAttempts: attempts,
          lastPublishError: err instanceof Error ? err.message : String(err),
          status: attempts >= 3 ? 'PUBLISHING' : post.status,
        },
      })
      failed++
      logError(`[Cron:Publisher] Failed post ${post.id}`, err)
    }
  }

  if (duePosts.length > 0) {
    logger.info(`[Cron:Publisher] ${published} published, ${failed} failed of ${duePosts.length} due`)
  }
}

async function runRenderer() {
  const staleThreshold = new Date(Date.now() - RENDER_TIMEOUT_MS)
  const renderingPosts = await prisma.post.findMany({
    where: { status: 'RENDERING', updatedAt: { lt: staleThreshold } },
    select: { id: true, format: true },
  })

  for (const post of renderingPosts) {
    try {
      const job = await renderQueue.getJob(`render-${post.id}`)
      const jobState = job ? await job.getState() : null
      if (jobState && ['active', 'waiting', 'delayed'].includes(jobState)) continue
      await prisma.post.update({ where: { id: post.id }, data: { status: 'DRAFT_PENDING' } })
      await prisma.renderJob.deleteMany({ where: { postId: post.id } })
      logger.warn({ postId: post.id }, '[Cron:Renderer] Reset stale RENDERING post')
    } catch (err) {
      logError(`[Cron:Renderer] Failed to reset stale post ${post.id}`, err)
    }
  }

  const drafts = await prisma.post.findMany({
    where: { status: 'DRAFT_APPROVED' },
    include: { renderJob: true },
  })

  for (const post of drafts) {
    if (USER_MANAGED_FORMATS.has(post.format ?? '') && !post.userUploadedMediaUrl) continue
    if (post.renderJob && ['queued', 'rendering', 'uploading', 'done'].includes(post.renderJob.status)) continue
    try {
      await addRenderJob(post.id)
      await prisma.post.update({ where: { id: post.id }, data: { status: 'RENDERING' } })
      logger.info(`[Cron:Renderer] Enqueued ${post.id}`)
    } catch (err) {
      logError(`[Cron:Renderer] Failed to enqueue ${post.id}`, err)
    }
  }
}



async function runTokenRefresh() {
  const lockKey = 'cron:token-refresh:lock'
  const acquired = await acquireLock(lockKey, 300_000)
  if (!acquired) return
  try {
    const results = await checkAllTokens()
    const refreshed = results.filter((r) => r.status === 'refreshed').length
    logger.info(`[Cron:TokenRefresh] ${results.length} checked, ${refreshed} refreshed`)
  } catch (err) {
    logError('[Cron:TokenRefresh] Error', err)
  } finally {
    await releaseLock(lockKey)
  }
}

function safe(name: string, fn: () => Promise<void>) {
  return () => fn().catch((err) => logError(`[Cron:${name}] Unhandled error`, err))
}

async function runApprovalNotifications() {
  const brands = await prisma.brand.findMany({ select: { id: true } })
  await Promise.allSettled(
    brands.flatMap((b) => [notifyTodayDigest(b.id), notifyNextInLine(b.id)]),
  )
}

export async function startInternalCron() {
  const { default: cron } = await import('node-cron')

  // Publisher — every 5 minutes
  cron.schedule('*/5 * * * *', safe('Publisher', runPublisher))

  // Renderer safety-net — every 10 minutes
  cron.schedule('*/10 * * * *', safe('Renderer', runRenderer))

  // Instagram token refresh — once daily at 03:00
  cron.schedule('0 3 * * *', safe('TokenRefresh', runTokenRefresh))

  // Approval notifications — every 5 minutes (today digest + next-in-line)
  cron.schedule('*/5 * * * *', safe('ApprovalNotifications', runApprovalNotifications))

  logger.info('[InternalCron] Scheduler started')
}
