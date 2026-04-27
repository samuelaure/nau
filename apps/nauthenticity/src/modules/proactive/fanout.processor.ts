import { runUniversalBatchInstagramScraper } from '../../services/apify.service';
import {
  generateCommentSuggestions,
  type CommentSuggestionParams,
} from '../../services/intelligence.service';
import { dispatchToZazu } from './zazu.dispatcher';
import { logger } from '../../utils/logger';
import { prisma } from '../../modules/shared/prisma';
import { toZonedTime } from 'date-fns-tz';
import type { Brand, SocialProfileMonitor, SocialProfile } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BrandWithMonitors = Brand & {
  monitors: (SocialProfileMonitor & { socialProfile: SocialProfile })[];
};

// ---------------------------------------------------------------------------
// Window logic
// ---------------------------------------------------------------------------

export function isInWindow(brand: Brand, now: Date): boolean {
  if (!brand.windowStart || !brand.windowEnd) return false;

  const zoned = toZonedTime(now, brand.timezone);
  const currentMin = zoned.getHours() * 60 + zoned.getMinutes();

  const [sh, sm] = brand.windowStart.split(':').map(Number);
  const [eh, em] = brand.windowEnd.split(':').map(Number);
  const startMin = sh * 60 + (sm ?? 0);
  const endMin = eh * 60 + (em ?? 0);

  if (startMin <= endMin) {
    return currentMin >= startMin && currentMin < endMin;
  } else {
    return currentMin >= startMin || currentMin < endMin;
  }
}

// ---------------------------------------------------------------------------
// Smart Fanout — called by the scheduler every 15 minutes
// ---------------------------------------------------------------------------

export const runProactiveFanout = async (now: Date = new Date()): Promise<void> => {
  logger.info(`[FanoutProcessor] Starting smart fanout cycle at ${now.toISOString()}...`);

  const allBrands = (await prisma.brand.findMany({
    include: {
      monitors: {
        where: { monitoringType: 'content', isActive: true },
        include: { socialProfile: true },
      },
    },
  })) as BrandWithMonitors[];

  if (allBrands.length === 0) {
    logger.info(`[FanoutProcessor] No active brands. Exiting.`);
    return;
  }

  const eligibleTargets = new Map<string, Set<string>>();

  for (const brand of allBrands) {
    const inWindow = isInWindow(brand, now);
    const thresholdMs = inWindow ? 15 * 60 * 1000 : 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - thresholdMs);

    for (const target of brand.monitors) {
      const lastScrape = target.socialProfile.lastScrapedAt;
      const profileUsername = target.socialProfile.username;
      if (!lastScrape || lastScrape < cutoff) {
        if (!eligibleTargets.has(profileUsername)) {
          eligibleTargets.set(profileUsername, new Set());
        }
        eligibleTargets.get(profileUsername)!.add(brand.id);
      }
    }
  }

  if (eligibleTargets.size === 0) {
    logger.info(`[FanoutProcessor] No eligible targets this cycle. All within threshold.`);
    return;
  }

  const usernames = [...eligibleTargets.keys()];
  logger.info(
    `[FanoutProcessor] Scraping ${usernames.length} unique profile(s): ${usernames.join(', ')}`,
  );

  let scrapedItems: Awaited<ReturnType<typeof runUniversalBatchInstagramScraper>>['items'];
  try {
    const result = await runUniversalBatchInstagramScraper(usernames, 4);
    scrapedItems = result.items;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[FanoutProcessor] Apify batch scraping failed: ${msg}`);
    return;
  }

  await prisma.socialProfile.updateMany({
    where: { username: { in: usernames } },
    data: { lastScrapedAt: now },
  });

  const brandMap = new Map(allBrands.map((b) => [b.id, b]));

  for (const item of scrapedItems) {
    const interestedBrandIds = eligibleTargets.get(item.ownerUsername);
    if (!interestedBrandIds) continue;

    for (const brandId of interestedBrandIds) {
      const brand = brandMap.get(brandId);
      if (!brand) continue;

      let localPost = await prisma.post.findFirst({
        where: {
          OR: [{ platformId: item.id }, { url: item.url }],
        },
      });

      if (!localPost) {
        localPost = await prisma.post.create({
          data: {
            platformId: item.id,
            url: item.url,
            username: item.ownerUsername,
            caption: item.caption ?? '',
            postedAt: new Date(item.timestamp),
            likes: item.likesCount ?? 0,
            comments: item.commentsCount ?? 0,
          },
        });
      }

      const alreadyProcessed = await prisma.commentFeedback.findFirst({
        where: { brandId, postId: localPost.id },
      });
      if (alreadyProcessed) {
        logger.info(
          `[FanoutProcessor] Skipping already-processed post ${localPost.id} for brand ${brandId}`,
        );
        continue;
      }

      const lastSelectedFeedbacks = await prisma.commentFeedback.findMany({
        where: { brandId, isSelected: true },
        orderBy: { sentAt: 'desc' },
        take: 9,
        select: { commentText: true },
      });
      const lastSelectedComments = lastSelectedFeedbacks.map((f) => f.commentText);

      const brandTarget = brand.monitors.find((t) => t.socialProfile.username === item.ownerUsername);

      logger.info(
        `[FanoutProcessor] Generating ${brand.suggestionsCount} comment(s) for brand ${brandId} on @${item.ownerUsername}...`,
      );

      try {
        const suggestionParams: CommentSuggestionParams = {
          post: {
            caption: item.caption ?? '',
            transcriptText: undefined,
            url: item.url,
            targetUsername: item.ownerUsername,
          },
          brand: {
            voicePrompt: brand.voicePrompt,
            commentStrategy: brand.commentStrategy,
            suggestionsCount: brand.suggestionsCount,
          },
          // profileStrategy: brandTarget?.settings ?? null,
          lastSelectedComments,
        };

        const suggestions = await generateCommentSuggestions(suggestionParams);

        await dispatchToZazu({
          workspaceId: brand.workspaceId,
          brandId,
          brandName: brandId, // brand name now lives in 9naŭ — use brandId as fallback label
          targetUsername: item.ownerUsername,
          postUrl: item.url,
          postThumbnailUrl: item.displayUrl ?? '',
          suggestions,
          localPostId: localPost.id,
        });

        await prisma.commentFeedback.create({
          data: {
            brandId,
            postId: localPost.id,
            commentText: JSON.stringify(suggestions),
            isSelected: false,
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(
          `[FanoutProcessor] Error processing brand ${brandId} for post ${item.shortCode ?? localPost.id}: ${msg}`,
        );
      }
    }
  }

  logger.info(`[FanoutProcessor] Cycle completed.`);
};
