import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import { runCoverageChecks } from './coverage.service'

/**
 * Called after every successful PUBLISHED transition (automatic or manual).
 * Marks the linked PostSlot as published, then runs coverage checks fire-and-forget.
 */
export async function onPostPublished(postId: string, brandId: string): Promise<void> {
  // Mark the slot as published if one is linked
  await prisma.postSlot.updateMany({
    where: { postId },
    data: { status: 'published' },
  })

  // Fire-and-forget — do not block the caller
  runCoverageChecks(brandId).catch((err) => {
    logger.error({ brandId, postId, err }, '[POST_PUBLISHED] Coverage check failed')
  })
}
