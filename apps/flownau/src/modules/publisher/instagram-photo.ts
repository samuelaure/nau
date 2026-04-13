import axios from 'axios'
import { logger, logError } from '@/modules/shared/logger'
import { pollContainerStatus, fetchPermalink } from './instagram-reels'
import { type PublishResult, type IGPublishParams, IG_BASE_URL } from './types'

interface PhotoPublishParams extends IGPublishParams {
  imageUrl: string
  altText?: string
}

/**
 * Publish a single Photo to Instagram.
 * Standard single-image post flow with optional alt text for accessibility.
 */
export async function publishPhoto(params: PhotoPublishParams): Promise<PublishResult> {
  const { accessToken, igUserId, imageUrl, caption, altText } = params

  try {
    // Step 1: Create image container
    const containerPayload: Record<string, string> = {
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }
    if (altText) {
      containerPayload.alt_text = altText
    }

    logger.info(`[PublishPhoto] Creating photo container for IG user ${igUserId}`)
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

    logger.info(`[PublishPhoto] Published photo ${mediaId}`)
    return { success: true, externalId: mediaId, permalink: permalink ?? undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logError('[PublishPhoto] Failed', err)
    return { success: false, error: msg }
  }
}
