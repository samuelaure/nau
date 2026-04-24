import axios from 'axios'
import { logger, logError } from '@/modules/shared/logger'
import {
  type PublishResult,
  type IGPublishParams,
  IG_BASE_URL,
  MAX_POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
} from './types'

interface ReelPublishParams extends IGPublishParams {
  videoUrl: string
  coverUrl?: string
}

/**
 * Publish a standard Reel to Instagram.
 * 3-step flow: create container → poll status → publish.
 */
export async function publishReel(params: ReelPublishParams): Promise<PublishResult> {
  const { accessToken, igUserId, videoUrl, caption, coverUrl } = params

  try {
    // Step 1: Create media container
    const containerPayload: Record<string, string> = {
      video_url: videoUrl,
      media_type: 'REELS',
      caption,
      share_to_feed: 'true',
      access_token: accessToken,
    }
    if (coverUrl) {
      containerPayload.cover_url = coverUrl
    }

    logger.info(`[PublishReel] Creating container for IG user ${igUserId}`)
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

    logger.info(`[PublishReel] Published reel ${mediaId}`)
    return { success: true, externalId: mediaId, permalink: permalink ?? undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logError('[PublishReel] Failed', err)
    return { success: false, error: msg }
  }
}

// ─── Shared Helpers ────────────────────────────────────────────────

export async function pollContainerStatus(containerId: string, accessToken: string): Promise<void> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    const statusRes = await axios.get(`${IG_BASE_URL}/${containerId}`, {
      params: { fields: 'status_code', access_token: accessToken },
    })
    const status: string = statusRes.data.status_code

    if (status === 'FINISHED') return
    if (status === 'ERROR') {
      throw new Error(`Instagram container ${containerId} processing failed (ERROR)`)
    }
    // IN_PROGRESS — continue polling
  }
  throw new Error(`Instagram container ${containerId} timed out after ${MAX_POLL_ATTEMPTS} polls`)
}

export async function fetchPermalink(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await axios.get(`${IG_BASE_URL}/${mediaId}`, {
      params: { fields: 'permalink', access_token: accessToken },
    })
    return res.data.permalink ?? null
  } catch {
    logger.warn(`[Instagram] Failed to fetch permalink for media ${mediaId}`)
    return null
  }
}
