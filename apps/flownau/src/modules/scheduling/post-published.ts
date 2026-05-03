import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import { runCoverageChecks } from './coverage.service'

export async function onPostPublished(postId: string, brandId: string): Promise<void> {
  await prisma.postSlot.updateMany({
    where: { postId },
    data: { status: 'published' },
  })

  runCoverageChecks(brandId).catch((err) => {
    logger.error({ brandId, postId, err }, '[POST_PUBLISHED] Coverage check failed')
  })

  // Dynamic import to avoid pulling nau-storage into the instrumentation hook's static module graph
  import('@/modules/publisher/post-compress').then(({ compressPublishedPost }) => {
    compressPublishedPost(postId).catch((err) => {
      logger.error({ postId, err }, '[POST_PUBLISHED] Post-publish compression failed')
    })
  })
}
