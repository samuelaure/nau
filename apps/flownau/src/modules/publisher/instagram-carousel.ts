import axios from 'axios'
import { logger, logError } from '@/modules/shared/logger'
import { pollContainerStatus, fetchPermalink } from './instagram-reels'
import { type PublishResult, type IGPublishParams, IG_BASE_URL } from './types'

interface CarouselPublishParams extends IGPublishParams {
  imageUrls: string[]
}

/**
 * Publish a Carousel post to Instagram.
 * Multi-step flow:
 * 1. Create child containers for each image
 * 2. Create parent carousel container with all children
 * 3. Poll parent status
 * 4. Publish
 */
export async function publishCarousel(params: CarouselPublishParams): Promise<PublishResult> {
  const { accessToken, igUserId, imageUrls, caption } = params

  if (imageUrls.length < 2 || imageUrls.length > 10) {
    return {
      success: false,
      error: `Carousel requires 2-10 images, got ${imageUrls.length}`,
    }
  }

  try {
    // Step 1: Create child container for each image
    const childIds: string[] = []

    for (let i = 0; i < imageUrls.length; i++) {
      logger.info(`[PublishCarousel] Creating child container ${i + 1}/${imageUrls.length}`)
      const childRes = await axios.post(`${IG_BASE_URL}/${igUserId}/media`, {
        image_url: imageUrls[i],
        is_carousel_item: 'true',
        access_token: accessToken,
      })
      childIds.push(childRes.data.id)
    }

    // Step 2: Create parent carousel container
    logger.info(
      `[PublishCarousel] Creating parent carousel container with ${childIds.length} children`,
    )
    const parentRes = await axios.post(`${IG_BASE_URL}/${igUserId}/media`, {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
      access_token: accessToken,
    })
    const parentId: string = parentRes.data.id

    // Step 3: Poll until FINISHED
    await pollContainerStatus(parentId, accessToken)

    // Step 4: Publish
    const publishRes = await axios.post(`${IG_BASE_URL}/${igUserId}/media_publish`, {
      creation_id: parentId,
      access_token: accessToken,
    })
    const mediaId: string = publishRes.data.id

    // Step 5: Fetch permalink
    const permalink = await fetchPermalink(mediaId, accessToken)

    logger.info(`[PublishCarousel] Published carousel ${mediaId} (${childIds.length} slides)`)
    return { success: true, externalId: mediaId, permalink: permalink ?? undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logError('[PublishCarousel] Failed', err)
    return { success: false, error: msg }
  }
}
