import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import { runCoverageChecks } from './coverage.service'
import { compressPublishedPost } from '@/modules/publisher/post-compress'

export async function onPostPublished(postId: string, brandId: string): Promise<void> {
  await prisma.postSlot.updateMany({
    where: { postId },
    data: { status: 'published' },
  })

  runCoverageChecks(brandId).catch((err) => {
    logger.error({ brandId, postId, err }, '[POST_PUBLISHED] Coverage check failed')
  })

  compressPublishedPost(postId).catch((err) => {
    logger.error({ postId, err }, '[POST_PUBLISHED] Post-publish compression failed')
  })
}
