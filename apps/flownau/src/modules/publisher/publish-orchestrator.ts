import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import { refreshTokenIfNeeded } from './instagram-token'
import { publishReel } from './instagram-reels'
import { publishTrialReel } from './instagram-trial-reels'
import { publishCarousel } from './instagram-carousel'
import { publishPhoto } from './instagram-photo'
import type { PublishResult } from './types'

interface PostForPublish {
  id: string
  format: string | null
  videoUrl: string | null
  coverUrl: string | null
  caption: string | null
  hashtags: string[]
  socialProfile: {
    id: string
    accessToken: string
    platformId: string | null
    tokenExpiresAt: Date | null
  }
}

function buildCaption(caption: string | null, hashtags: string[]): string {
  let result = caption || 'New content'
  if (hashtags.length > 0) {
    const hashtagStr = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    result = `${result}\n\n${hashtagStr}`
  }
  return result
}

export async function publishComposition(post: PostForPublish): Promise<PublishResult> {
  const account = post.socialProfile

  if (!account?.platformId) {
    return { success: false, error: `Account ${account.id} has no Instagram platformId` }
  }

  if (!post.videoUrl) {
    return { success: false, error: `Post ${post.id} has no rendered output URL` }
  }

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

  const caption = buildCaption(post.caption, post.hashtags)
  const igUserId = account.platformId

  logger.info(`[PublishOrchestrator] Publishing ${post.format} post ${post.id}`)

  let result: PublishResult

  switch (post.format) {
    case 'reel':
      result = await publishReel({ accessToken: validToken, igUserId, videoUrl: post.videoUrl, caption, coverUrl: post.coverUrl ?? undefined })
      break
    case 'trial_reel':
      result = await publishTrialReel({ accessToken: validToken, igUserId, videoUrl: post.videoUrl, caption })
      break
    case 'carousel': {
      const imageUrls = post.videoUrl.split(',').map((u) => u.trim())
      result = await publishCarousel({ accessToken: validToken, igUserId, imageUrls, caption })
      break
    }
    case 'single_image':
      result = await publishPhoto({ accessToken: validToken, igUserId, imageUrl: post.videoUrl, caption })
      break
    default:
      result = { success: false, error: `Unknown format: ${post.format}` }
  }

  if (result.success) {
    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: 'PUBLISHED',
        externalPostId: result.externalId ?? null,
        externalPostUrl: result.permalink ?? null,
        publishedAt: new Date(),
      },
    })
    logger.info(`[PublishOrchestrator] Published ${post.id} → ${result.permalink ?? result.externalId}`)
  }

  return result
}
