import { Worker, Job } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { prisma } from '../modules/shared/prisma';
import { logger } from '../utils/logger';
import { logContextStorage } from '../utils/context';
import { scrapePostByUrl } from '../services/apify.service';
import { optimizeVideoForArchive, optimizeImage, probeDimensions } from '../utils/media';
import { createStorage, nauthenticity } from 'nau-storage';

const storage =
  config.env.R2_ENDPOINT &&
  config.env.R2_ACCESS_KEY_ID &&
  config.env.R2_SECRET_ACCESS_KEY &&
  config.env.R2_BUCKET_NAME &&
  config.env.R2_PUBLIC_URL
    ? createStorage({
        endpoint: config.env.R2_ENDPOINT,
        accessKeyId: config.env.R2_ACCESS_KEY_ID,
        secretAccessKey: config.env.R2_SECRET_ACCESS_KEY,
        bucket: config.env.R2_BUCKET_NAME,
        publicUrl: config.env.R2_PUBLIC_URL,
        envPrefix: config.env.NODE_ENV,
      })
    : null;

export interface ReprocessCaptureData {
  url: string;
}

export interface ReprocessedMedia {
  type: 'image' | 'video';
  storageUrl: string;
  width: number | null;
  height: number | null;
  index: number;
}

export type ReprocessCaptureResult =
  | { outcome: 'found'; postUrl: string; caption: string | null; postedAt: string; media: ReprocessedMedia[] }
  | { outcome: 'not_found'; postUrl: string };

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const mobileReprocessWorker = new Worker(
  'mobile-reprocess-queue',
  async (job: Job<ReprocessCaptureData>): Promise<ReprocessCaptureResult> => {
    return logContextStorage.run({ jobId: job.id, ...job.data }, async () => {
      if (!storage) {
        throw new Error('R2 storage is not configured — cannot archive mobile captures');
      }

      const { url } = job.data;
      logger.info(`[MobileReprocess] Scraping ${url}`);

      const scraped = await scrapePostByUrl(url);
      if (!scraped) {
        logger.warn(`[MobileReprocess] ${url} no longer resolves on Instagram`);
        return { outcome: 'not_found', postUrl: url };
      }

      const username = scraped.author.username;

      // Keep the Post row so re-runs and the dashboard can see this was reprocessed,
      // but don't build the full collaborator/socialProfile graph — mobile only needs media.
      const post = await prisma.post.upsert({
        where: { url },
        update: {
          caption: scraped.caption,
          likes: Math.max(0, scraped.likesCount ?? 0),
          comments: Math.max(0, scraped.commentsCount ?? 0),
        },
        create: {
          platformId: scraped.id || scraped.shortcode,
          url,
          username,
          caption: scraped.caption,
          postedAt: new Date(scraped.takenAt),
          likes: Math.max(0, scraped.likesCount ?? 0),
          comments: Math.max(0, scraped.commentsCount ?? 0),
        },
        include: { media: true },
      });

      ensureDir(config.paths.temp);

      const results: ReprocessedMedia[] = [];

      for (let i = 0; i < scraped.media.length; i++) {
        const m = scraped.media[i];
        if (!m.url) continue;

        const mediaId = post.media[i]?.id ?? randomUUID();
        const fileExt = m.type === 'video' ? 'mp4' : 'jpg';
        const rawPath = path.join(config.paths.temp, `${mediaId}_mobile_raw.${fileExt}`);
        const finalPath = path.join(config.paths.temp, `${mediaId}_mobile_final.${fileExt}`);

        try {
          const response = await fetch(m.url);
          if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`);
          await pipeline(response.body as any, createWriteStream(rawPath));

          if (m.type === 'video') {
            await optimizeVideoForArchive(rawPath, finalPath, () => job.extendLock(mediaId, 600_000));
          } else {
            await optimizeImage(rawPath, finalPath);
          }

          const dimensions =
            m.width && m.height ? { width: m.width, height: m.height } : await probeDimensions(rawPath);

          const storageKey = nauthenticity.post(username, mediaId, fileExt);
          const publicUrl = await storage.upload(storageKey, fs.createReadStream(finalPath), {
            mimeType: m.type === 'video' ? 'video/mp4' : 'image/jpeg',
          });

          await prisma.media.upsert({
            where: { id: mediaId },
            update: { storageUrl: publicUrl, url: m.url, width: dimensions?.width, height: dimensions?.height },
            create: {
              id: mediaId,
              postId: post.id,
              type: m.type,
              url: m.url,
              storageUrl: publicUrl,
              width: dimensions?.width,
              height: dimensions?.height,
              index: i,
            },
          });

          results.push({
            type: m.type,
            storageUrl: publicUrl,
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null,
            index: i,
          });
        } finally {
          if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
          if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
        }
      }

      await prisma.post.update({ where: { id: post.id }, data: { status: 'archived' } });

      logger.info(`[MobileReprocess] ${url} → ${results.length} media archived`);
      return {
        outcome: 'found',
        postUrl: url,
        caption: scraped.caption ?? null,
        postedAt: scraped.takenAt,
        media: results,
      };
    });
  },
  // concurrency 1: same reasoning as optimizationWorker — HEVC transcoding at native
  // resolution is CPU-heavy, and this is a backlog of 98, not a live user wait.
  { connection: config.redis, concurrency: 1, lockDuration: 600_000, stalledInterval: 120_000 },
);

mobileReprocessWorker.on('failed', (job, err) => {
  logger.error(`[MobileReprocess] Job ${job?.id ?? '?'} failed: ${err.message}`);
});
