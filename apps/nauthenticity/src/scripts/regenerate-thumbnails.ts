import { prisma } from '../modules/shared/prisma';
import { computeQueue } from '../queues/compute.queue';
import { logger } from '../utils/logger';

async function regenerateThumbnails() {
  try {
    logger.info('[RegenerateThumbnails] Starting thumbnail regeneration...');

    // Find all media without thumbnails
    const mediaWithoutThumbnails = await prisma.media.findMany({
      where: {
        OR: [{ thumbnailUrl: null }, { thumbnailUrl: '' }],
      },
      include: {
        post: {
          select: { id: true, runId: true, username: true },
        },
      },
    });

    logger.info(
      `[RegenerateThumbnails] Found ${mediaWithoutThumbnails.length} media items without thumbnails`,
    );

    if (mediaWithoutThumbnails.length === 0) {
      logger.info('[RegenerateThumbnails] No media without thumbnails found. Done!');
      process.exit(0);
    }

    // Queue them for visualization
    let queued = 0;
    for (const media of mediaWithoutThumbnails) {
      if (!media.post?.runId) {
        logger.warn(`[RegenerateThumbnails] Skipping media ${media.id} - no associated run`);
        continue;
      }

      await computeQueue.add(
        'visualize-batch',
        {
          runId: media.post.runId,
          username: media.post.username,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );

      queued++;
      logger.info(
        `[RegenerateThumbnails] Queued visualization for run ${media.post.runId} (${queued}/${mediaWithoutThumbnails.length})`,
      );
    }

    logger.info(`[RegenerateThumbnails] Successfully queued ${queued} items for thumbnail generation`);
    logger.info('[RegenerateThumbnails] Processing will start immediately. Monitor logs for progress.');

    process.exit(0);
  } catch (error) {
    logger.error(`[RegenerateThumbnails] Error: ${error}`);
    process.exit(1);
  }
}

regenerateThumbnails();
