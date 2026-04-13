import { prisma } from '@/modules/shared/prisma'
import { logger, logError } from '@/modules/shared/logger'
import { refreshTokenIfNeeded } from './instagram-token'
import { publishReel } from './instagram-reels'
import { publishTrialReel } from './instagram-trial-reels'
import { publishCarousel } from './instagram-carousel'
import { publishPhoto } from './instagram-photo'
import type { PublishResult } from './types'

interface CompositionForPublish {
  id: string
  format: string
  videoUrl: string | null
  coverUrl: string | null
  caption: string | null
  hashtags: string[]
  account: {
    id: string
    accessToken: string
    platformId: string | null
    tokenExpiresAt: Date | null
  }
}

/**
 * Build a full caption string from composition caption + hashtags.
 */
function buildCaption(caption: string | null, hashtags: string[]): string {
  let result = caption || 'New content'
  if (hashtags.length > 0) {
    const hashtagStr = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    result = `${result}\n\n${hashtagStr}`
  }
  return result
}

/**
 * Unified publish orchestrator.
 * Routes to the correct Instagram publisher based on composition format.
 * Handles token refresh, caption building, and DB status updates.
 */
export async function publishComposition(
  composition: CompositionForPublish,
): Promise<PublishResult> {
  const { account } = composition

  // Guard: platform ID required
  if (!account.platformId) {
    return { success: false, error: `Account ${account.id} has no Instagram platformId` }
  }

  // Guard: rendered content required
  if (!composition.videoUrl) {
    return { success: false, error: `Composition ${composition.id} has no rendered output URL` }
  }

  // Pre-publish: refresh token if needed
  let validToken: string
  try {
    validToken = await refreshTokenIfNeeded({
      id: account.id,
      accessToken: account.accessToken,
      tokenExpiresAt: account.tokenExpiresAt,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Token refresh failed: ${msg}` }
  }

  const caption = buildCaption(composition.caption, composition.hashtags)
  const igUserId = account.platformId

  logger.info(
    `[PublishOrchestrator] Publishing ${composition.format} composition ${composition.id}`,
  )

  let result: PublishResult

  switch (composition.format) {
    case 'reel':
      result = await publishReel({
        accessToken: validToken,
        igUserId,
        videoUrl: composition.videoUrl,
        caption,
        coverUrl: composition.coverUrl ?? undefined,
      })
      break

    case 'trial_reel':
      result = await publishTrialReel({
        accessToken: validToken,
        igUserId,
        videoUrl: composition.videoUrl,
        caption,
      })
      break

    case 'carousel': {
      // For carousels, videoUrl contains comma-separated image URLs
      // (set by the render worker when uploading multiple slides)
      const imageUrls = composition.videoUrl.split(',').map((u) => u.trim())
      result = await publishCarousel({
        accessToken: validToken,
        igUserId,
        imageUrls,
        caption,
      })
      break
    }

    case 'single_image':
      result = await publishPhoto({
        accessToken: validToken,
        igUserId,
        imageUrl: composition.videoUrl,
        caption,
      })
      break

    default:
      result = { success: false, error: `Unknown format: ${composition.format}` }
  }

  // Update DB based on result
  if (result.success) {
    await prisma.composition.update({
      where: { id: composition.id },
      data: {
        status: 'published',
        externalPostId: result.externalId ?? null,
        externalPostUrl: result.permalink ?? null,
      },
    })
    logger.info(
      `[PublishOrchestrator] Published ${composition.id} → ${result.permalink ?? result.externalId}`,
    )
  }

  return result
}
