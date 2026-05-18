import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import { runCoverageChecks } from './coverage.service'
import { signServiceToken } from '@nau/auth'
import { notifyTomorrowDigest } from '@/modules/notifications/approval-notifications'

export async function onPostPublished(postId: string, brandId: string): Promise<void> {
  runCoverageChecks(brandId).catch((err) => {
    logger.error({ brandId, postId, err }, '[POST_PUBLISHED] Coverage check failed')
  })

  syncToNauthenticity(postId, brandId).catch((err) => {
    logger.error({ postId, brandId, err }, '[POST_PUBLISHED] Nauthenticity sync failed')
  })

  maybeNotifyTomorrowDigest(brandId).catch((err) => {
    logger.error({ postId, brandId, err }, '[POST_PUBLISHED] Tomorrow digest notification failed')
  })

  // Dynamic import to avoid pulling nau-storage into the instrumentation hook's static module graph
  import('@/modules/publisher/post-compress').then(({ compressPublishedPost }) => {
    compressPublishedPost(postId).catch((err) => {
      logger.error({ postId, err }, '[POST_PUBLISHED] Post-publish compression failed')
    })
  })
}

async function syncToNauthenticity(postId: string, brandId: string): Promise<void> {
  const nauthenicityUrl = process.env.NAUTHENTICITY_URL
  const authSecret = process.env.AUTH_SECRET
  if (!nauthenicityUrl || !authSecret) return

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      externalPostId: true,
      externalPostUrl: true,
      caption: true,
      publishedAt: true,
      videoUrl: true,
      coverUrl: true,
      format: true,
      postSynthesis: true,
      brand: {
        select: {
          socialProfiles: {
            where: { nauthenticityProfileId: { not: null } },
            select: { nauthenticityProfileId: true },
            take: 1,
          },
        },
      },
    },
  })

  if (!post?.externalPostUrl || !post.publishedAt) return
  const nauthenticityProfileId = post.brand.socialProfiles[0]?.nauthenticityProfileId
  if (!nauthenticityProfileId) return

  const media: Array<{
    type: string
    url: string
    thumbnailUrl?: string | null
    duration?: null
    index: number
  }> = []
  if (post.videoUrl) {
    media.push({
      type: post.format ?? 'video',
      url: post.videoUrl,
      thumbnailUrl: post.coverUrl ?? null,
      index: 0,
    })
  }

  const token = await signServiceToken({ secret: authSecret, iss: 'flownau', aud: 'nauthenticity' })

  const res = await fetch(`${nauthenicityUrl}/_service/posts/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      flownauPostId: postId,
      nauthenticityProfileId,
      externalPostId: post.externalPostId ?? null,
      url: post.externalPostUrl,
      caption: post.caption ?? null,
      postedAt: post.publishedAt,
      postSynthesis: post.postSynthesis ?? null,
      media,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.error(
      { postId, status: res.status, body: text },
      '[POST_PUBLISHED] Nauthenticity sync HTTP error',
    )
  } else {
    logger.info({ postId, nauthenticityProfileId }, '[POST_PUBLISHED] Synced post to nauthenticity')
  }
}

async function maybeNotifyTomorrowDigest(brandId: string): Promise<void> {
  const now = new Date()
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  // Only trigger if no more posts are scheduled for today after this one
  const remaining = await prisma.post.count({
    where: {
      brandId,
      scheduledAt: { gt: now, lte: endOfDay },
      status: { notIn: ['PUBLISHED', 'FAILED'] },
    },
  })

  if (remaining === 0) {
    await notifyTomorrowDigest(brandId)
  }
}
