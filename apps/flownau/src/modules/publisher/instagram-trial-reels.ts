import axios from 'axios'
import { logger, logError } from '@/modules/shared/logger'
import { pollContainerStatus, fetchPermalink } from './instagram-reels'
import { type PublishResult, type IGPublishParams, IG_BASE_URL } from './types'

interface TrialReelPublishParams extends IGPublishParams {
  videoUrl: string
  // MANUAL: stays as trial until manually graduated in the Instagram app (safe default for pipeline)
  // SS_PERFORMANCE: auto-graduates to followers if performance meets Instagram's thresholds
  graduationStrategy?: 'MANUAL' | 'SS_PERFORMANCE'
}

export async function publishTrialReel(params: TrialReelPublishParams): Promise<PublishResult> {
  const { accessToken, igUserId, videoUrl, caption, graduationStrategy = 'MANUAL' } = params

  try {
    // Step 1: Create container with trial_params
    const containerPayload: Record<string, string> = {
      video_url: videoUrl,
      media_type: 'REELS',
      caption,
      access_token: accessToken,
      trial_params: JSON.stringify({ graduation_strategy: graduationStrategy }),
    }

    logger.info(`[PublishTrialReel] Creating trial reel container (strategy: ${graduationStrategy})`)
    const containerRes = await axios.post(`${IG_BASE_URL}/${igUserId}/media`, containerPayload)
    const containerId: string = containerRes.data.id

    // Step 2: Poll until FINISHED
    await pollContainerStatus(containerId, accessToken)

    // Step 3: Publish
    const publishRes = await axios.post(`${IG_BASE_URL}/${igUserId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    })
    const mediaId: string = publishRes.data.id

    // Step 4: Fetch permalink
    const permalink = await fetchPermalink(mediaId, accessToken)

    logger.info(`[PublishTrialReel] Published trial reel ${mediaId}`)
    return { success: true, externalId: mediaId, permalink: permalink ?? undefined }
  } catch (err) {
    // Log the full Instagram API error body, not just the axios message
    const apiError = axios.isAxiosError(err) ? err.response?.data : undefined
    logError('[PublishTrialReel] Failed', err)
    if (apiError) logger.error({ apiError }, '[PublishTrialReel] Instagram API error body')
    const msg = axios.isAxiosError(err) && apiError?.error?.message
      ? apiError.error.message
      : err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}
