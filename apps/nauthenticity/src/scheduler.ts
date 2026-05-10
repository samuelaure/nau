import cron from 'node-cron';
import { runProactiveFanout } from './modules/proactive/fanout.processor';
import { ingestionQueue } from './queues/ingestion.queue';
import { prisma } from './modules/shared/prisma';
import { logger } from './utils/logger';

/**
 * Smart Fanout Scheduler
 *
 * Runs every 15 minutes. The fanout processor internally evaluates each brand's
 * delivery window to decide whether to apply the 15-min (in-window) or 60-min
 * (out-of-window) scraping threshold per target account.
 *
 * Result: minimal Apify API usage whilst maximising freshness for active users.
 */

/**
 * INSPO/BENCHMARK Refresh Scheduler
 *
 * Runs every 6 hours. Collects all unique profiles across all brands/projects
 * in INSPO and BENCHMARK categories, then queues updateSync ingestion for any
 * that haven't been scraped in the last 6 hours. A single ingestion job per
 * username serves all brands/projects that share that profile — no duplicate
 * Apify calls.
 */
const runInspoRefresh = async (): Promise<void> => {
  const staleThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const memberships = await prisma.categoryMembership.findMany({
    where: {
      category: { in: ['INSPO', 'BENCHMARK'] },
      isActive: true,
      socialProfileId: { not: null },
    },
    select: { socialProfile: { select: { username: true, lastScrapedAt: true } } },
  });

  // Deduplicate by username and filter for stale profiles
  const staleUsernames = new Set<string>();
  for (const m of memberships) {
    const { username, lastScrapedAt } = m.socialProfile!;
    if (!lastScrapedAt || lastScrapedAt < staleThreshold) {
      staleUsernames.add(username);
    }
  }

  if (staleUsernames.size === 0) {
    logger.info('[Scheduler] INSPO refresh: all profiles are fresh.');
    return;
  }

  const activeJobs = await ingestionQueue.getJobs(['active', 'waiting', 'delayed']);
  const inFlightUsernames = new Set(activeJobs.map((j) => j.data.username as string));

  let queued = 0;
  for (const username of staleUsernames) {
    if (inFlightUsernames.has(username)) continue;
    await ingestionQueue.add('start-ingestion', { username, limit: 30, updateSync: true });
    queued++;
  }

  logger.info(
    `[Scheduler] INSPO refresh: queued ${queued} ingestion job(s) for ${staleUsernames.size} unique profile(s).`,
  );
};

export const startScheduler = (): void => {
  const fanoutTask = cron.schedule('*/15 * * * *', () => {
    logger.info('[Scheduler] Triggering smart fanout cycle...');
    runProactiveFanout().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Scheduler] Fanout cycle failed: ${msg}`);
    });
  });

  const inspoTask = cron.schedule('0 */6 * * *', () => {
    logger.info('[Scheduler] Triggering INSPO/BENCHMARK refresh...');
    runInspoRefresh().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Scheduler] INSPO refresh failed: ${msg}`);
    });
  });

  void fanoutTask.start();
  void inspoTask.start();
  logger.info('[Scheduler] Smart fanout cron started (every 15 minutes).');
  logger.info('[Scheduler] INSPO/BENCHMARK refresh cron started (every 6 hours).');
};
