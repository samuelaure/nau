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
import { scrapeMobileCapture } from '../services/apify.service';
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
  | {
      outcome: 'found';
      postUrl: string;
      username: string | null;
      caption: string | null;
      postedAt: string;
      media: ReprocessedMedia[];
    }
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

      // Uses apify/instagram-scraper (Apify's maintained actor), not
      // nau-ig-actor — verified against real posts to return correct,
      // distinct content per URL. nau-ig-actor's postUrls path could not be
      // used here: confirmed against a real 98-post batch that it returned
      // the exact same wrong post for every /reel/ URL requested (its input
      // recognition only matched the plural, non-post /reels/), and its
      // single-post detail endpoint for /p/ URLs hits a Instagram API that
      // now requires a login it doesn't have. See
      // nau-mobile/docs/reprocessing-pipeline.md.
      // A single null isn't necessarily "gone" — any scraper can hit a
      // transient block, and returning normally (not throwing) means BullMQ's
      // own job-retry never engages. Learned the hard way on the previous
      // actor: 7/98 came back null on the first pass and all still existed.
      // Two tries, spaced out, before treating this as disposition-relevant.
      let scraped = await scrapeMobileCapture(url);
      if (!scraped) {
        logger.warn(`[MobileReprocess] ${url} scrape returned nothing — retrying once`);
        await new Promise((r) => setTimeout(r, 20_000));
        scraped = await scrapeMobileCapture(url);
      }
      if (!scraped) {
        logger.warn(`[MobileReprocess] ${url} did not resolve after retry — reporting not_found`);
        return { outcome: 'not_found', postUrl: url };
      }

      const platformId = `mobile-${scraped.shortcode}`;
      const postData = {
        caption: scraped.caption,
      };

      // Upsert by url; platformId is derived from our own shortcode match
      // above and namespaced with 'mobile-' so it can never collide with a
      // platformId nauthenticity's normal profile-ingestion pipeline assigned
      // to the same content under a different url — worst case is a second
      // Post row for the same real post, never a merge of unrelated ones.
      const post = await prisma.post.upsert({
        where: { url },
        update: postData,
        create: {
          platformId,
          url,
          username: scraped.ownerUsername ?? undefined,
          postedAt: new Date(scraped.takenAt),
          ...postData,
        },
        include: { media: true },
      });

      ensureDir(config.paths.temp);

      const results: ReprocessedMedia[] = [];

      for (let i = 0; i < scraped.media.length; i++) {
        const m = scraped.media[i];
        if (!m.url) continue;

        const mediaId = post.media[i]?.id ?? randomUUID();
        // scraped.media[i].type comes from apify/instagram-scraper's own
        // per-item `type` field, which is reliable — but Content-Type on the
        // actual fetch is free to check and is the one signal no actor's
        // input-shape bug can misreport, so it stays authoritative here.
        const rawPathNoExt = path.join(config.paths.temp, `${mediaId}_mobile_raw`);
        const finalPathNoExt = path.join(config.paths.temp, `${mediaId}_mobile_final`);

        try {
          const response = await fetch(m.url);
          if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`);
          const contentType = response.headers.get('content-type') ?? '';
          const isVideo = contentType.startsWith('video/') || (contentType === '' && m.type === 'video');
          const fileExt = isVideo ? 'mp4' : 'jpg';
          const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';
          const rawPath = `${rawPathNoExt}.${fileExt}`;
          const finalPath = `${finalPathNoExt}.${fileExt}`;
          await pipeline(response.body as any, createWriteStream(rawPath));

          if (isVideo) {
            await optimizeVideoForArchive(rawPath, finalPath, () => job.extendLock(mediaId, 600_000));
          } else {
            await optimizeImage(rawPath, finalPath);
          }

          const dimensions =
            m.width && m.height ? { width: m.width, height: m.height } : await probeDimensions(rawPath);

          // Namespaced under 'mobile-archive' rather than the scraped
          // username: R2 key organisation only, has no bearing on identity.
          const storageKey = nauthenticity.post('mobile-archive', mediaId, fileExt);
          const publicUrl = await storage.upload(storageKey, fs.createReadStream(finalPath), {
            mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
          });

          await prisma.media.upsert({
            where: { id: mediaId },
            update: { storageUrl: publicUrl, url: m.url, width: dimensions?.width, height: dimensions?.height },
            create: {
              id: mediaId,
              postId: post.id,
              type: mediaType,
              url: m.url,
              storageUrl: publicUrl,
              width: dimensions?.width,
              height: dimensions?.height,
              index: i,
            },
          });

          results.push({
            type: mediaType,
            storageUrl: publicUrl,
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null,
            index: i,
          });
        } finally {
          // Extension is only known once Content-Type comes back, so clean up
          // by prefix rather than a single known path.
          for (const ext of ['mp4', 'jpg']) {
            const raw = `${rawPathNoExt}.${ext}`;
            const final = `${finalPathNoExt}.${ext}`;
            if (fs.existsSync(raw)) fs.unlinkSync(raw);
            if (fs.existsSync(final)) fs.unlinkSync(final);
          }
        }
      }

      await prisma.post.update({ where: { id: post.id }, data: { status: 'archived' } });

      logger.info(`[MobileReprocess] ${url} → ${results.length} media archived`);
      return {
        outcome: 'found',
        postUrl: url,
        username: scraped.ownerUsername,
        caption: scraped.caption,
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
