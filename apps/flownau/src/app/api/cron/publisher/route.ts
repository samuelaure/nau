import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { publishVideoToInstagram } from '@/modules/accounts/instagram'
import { logError, logger } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes — publishing only, no rendering

/**
 * GET /api/cron/publisher
 *
 * Publish rendered compositions to Instagram.
 * This cron ONLY handles Instagram API calls — rendering is fully decoupled
 * to the dedicated render worker (BullMQ queue).
 *
 * Part A: Explicitly scheduled compositions (scheduledAt <= now)
 * Part B: Auto-posted compositions via PostingSchedule
 */
export async function GET() {
  try {
    const results: Array<{
      type: string
      compositionId?: string
      accountId?: string
      status: string
      error?: string
    }> = []
    const now = new Date()

    // --- PART A: Explicitly Scheduled Compositions ---
    const explicitCompositions = await prisma.composition.findMany({
      where: {
        status: 'rendered',
        scheduledAt: { lte: now },
        publishAttempts: { lt: 3 },
      },
      include: {
        account: true,
      },
    })

    for (const composition of explicitCompositions) {
      if (
        !composition.account ||
        !composition.account.accessToken ||
        !composition.account.platformId
      ) {
        continue
      }
      try {
        await publishComposition(composition)
        results.push({ type: 'explicit', compositionId: composition.id, status: 'success' })
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        logError(`[Publisher] Explicit publish failed for ${composition.id}`, err)
        const attempts = composition.publishAttempts + 1
        await prisma.composition.update({
          where: { id: composition.id },
          data: {
            publishAttempts: attempts,
            lastPublishError: errMsg,
            status: attempts >= 3 ? 'failed' : 'rendered',
          },
        })
        results.push({
          type: 'explicit',
          compositionId: composition.id,
          status: 'failed',
          error: errMsg,
        })
      }
    }

    // --- PART B: Auto-Posted Compositions (PostingSchedule) ---
    const schedules = await prisma.postingSchedule.findMany({
      include: { account: true },
    })

    for (const schedule of schedules) {
      if (!schedule.account || !schedule.account.accessToken || !schedule.account.platformId) {
        continue
      }
      const msInDay = 24 * 60 * 60 * 1000
      const isDue =
        !schedule.lastPostedAt ||
        now.getTime() - new Date(schedule.lastPostedAt).getTime() >=
          schedule.frequencyDays * msInDay

      if (!isDue) {
        results.push({ type: 'auto', accountId: schedule.accountId, status: 'skipped_not_due' })
        continue
      }

      // Find the oldest rendered composition for this account
      const composition = await prisma.composition.findFirst({
        where: { accountId: schedule.accountId, status: 'rendered' },
        orderBy: { createdAt: 'asc' },
        include: { account: true },
      })

      if (!composition) {
        results.push({ type: 'auto', accountId: schedule.accountId, status: 'skipped_no_rendered' })
        continue
      }

      try {
        await publishComposition(composition)
        await prisma.postingSchedule.update({
          where: { id: schedule.id },
          data: { lastPostedAt: now },
        })
        results.push({ type: 'auto', compositionId: composition.id, status: 'success' })
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        logError(`[Publisher] Auto publish failed for ${composition.id}`, err)
        const attempts = composition.publishAttempts + 1
        await prisma.composition.update({
          where: { id: composition.id },
          data: {
            publishAttempts: attempts,
            lastPublishError: errMsg,
            status: attempts >= 3 ? 'failed' : 'rendered',
          },
        })
        results.push({
          type: 'auto',
          compositionId: composition.id,
          status: 'failed',
          error: errMsg,
        })
      }
    }

    return NextResponse.json({ message: 'Publisher Execution Finished', results })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Publisher] Fatal error', error)
    return NextResponse.json(
      { error: 'Fatal publisher failure', details: msg },
      { status: 500 },
    )
  }
}

/**
 * Publish a pre-rendered composition to Instagram.
 * No rendering happens here — the videoUrl is already set by the render worker.
 */
async function publishComposition(composition: {
  id: string
  videoUrl: string | null
  caption: string | null
  hashtags: string[]
  account: {
    accessToken: string
    platformId: string | null
  }
}): Promise<void> {
  if (!composition.videoUrl) {
    throw new Error(`Composition ${composition.id} has no rendered videoUrl`)
  }
  if (!composition.account.platformId) {
    throw new Error(`Composition ${composition.id} has no Instagram platformId`)
  }

  // Build caption with hashtags
  let caption = composition.caption || 'New content'
  if (composition.hashtags && composition.hashtags.length > 0) {
    const hashtagString = composition.hashtags.map((h) => `#${h}`).join(' ')
    caption = `${caption}\n\n${hashtagString}`
  }

  logger.info(`[Publisher] Publishing composition ${composition.id} to Instagram`)

  const igResult = await publishVideoToInstagram({
    accessToken: composition.account.accessToken,
    instagramUserId: composition.account.platformId,
    videoUrl: composition.videoUrl,
    caption,
  })

  await prisma.composition.update({
    where: { id: composition.id },
    data: {
      status: 'published',
      externalPostId: igResult.id,
      externalPostUrl: igResult.permalink,
    },
  })

  logger.info(`[Publisher] Successfully published ${composition.id} → ${igResult.permalink}`)
}
