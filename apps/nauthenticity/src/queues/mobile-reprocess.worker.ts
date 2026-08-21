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

      // scrapePostByUrl returns null both when the post is genuinely gone AND
      // when the actor got blocked scraping it (Instagram serving HTML instead
      // of JSON — a proxy/rate-limit block, not a verdict on the post). The
      // actor already retries 3x internally over ~30s before giving up with no
      // distinguishing error in the dataset, so a null here isn't reliable
      // evidence of "not found" on its own. Confirmed against a real batch:
      // 7/98 came back null this way for posts that, checked by hand, all
      // still existed. Retry across a longer window — spaced further apart
      // than the actor's own internal retries — before treating this as a
      // disposition-relevant outcome.
      let scraped: Awaited<ReturnType<typeof scrapePostByUrl>> = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        scraped = await scrapePostByUrl(url);
        if (scraped) break;
        if (attempt < 3) {
          logger.warn(`[MobileReprocess] ${url} scrape returned nothing (attempt ${attempt}/3) — retrying`);
          await new Promise((r) => setTimeout(r, 30_000));
        }
      }
      if (!scraped) {
        logger.warn(`[MobileReprocess] ${url} did not resolve after 3 attempts — reporting not_found`);
        return { outcome: 'not_found', postUrl: url };
      }

      const username = scraped.author.username;

      // Do NOT trust scraped.id/shortcode as an identity key: confirmed against
      // the real batch that a postUrls scrape can return the SAME id for
      // completely different posts — every one of 92 distinct URLs resolved to
      // the platformId of the very first post processed, which (combined with
      // the platformId-fallback lookup this comment used to describe) collapsed
      // all 92 into a single Post row, silently overwriting the same 6 R2
      // objects on every run. That is the third unreliable field this actor has
      // produced for direct-URL scrapes, after author.username and media[].type.
      // The post's own URL is the one thing we supplied and know is correct, so
      // derive identity from it instead — the shortcode is unique per post.
      const shortcodeMatch = url.match(/\/(?:p|reel|tv)\/([^/?#]+)/);
      const platformId = `mobile-${shortcodeMatch?.[1] ?? randomUUID()}`;
      const postData = {
        caption: scraped.caption,
        likes: Math.max(0, scraped.likesCount ?? 0),
        comments: Math.max(0, scraped.commentsCount ?? 0),
      };

      // Keep the Post row so re-runs and the dashboard can see this was
      // reprocessed, but don't build the full collaborator/socialProfile graph
      // — mobile only needs media. Upsert by url alone: no platformId-based
      // fallback lookup — see above for why that merged unrelated posts.
      const post = await prisma.post.upsert({
        where: { url },
        update: postData,
        create: { platformId, url, username, postedAt: new Date(scraped.takenAt), ...postData },
        include: { media: true },
      });

      ensureDir(config.paths.temp);

      const results: ReprocessedMedia[] = [];

      for (let i = 0; i < scraped.media.length; i++) {
        const m = scraped.media[i];
        if (!m.url) continue;

        const mediaId = post.media[i]?.id ?? randomUUID();
        // Don't trust m.type: for a single-post scrape (postUrls) the actor
        // labels every carousel child "sidecar_child" regardless of whether it
        // is a photo or a video, so 'video' vs not-'video' silently mis-sorts
        // any video hiding inside a carousel into the image path — one ffmpeg
        // frame grab and the only surviving copy is gone. Content-Type from
        // the actual fetch is authoritative; m.type is not used at all below.
        const rawPathNoExt = path.join(config.paths.temp, `${mediaId}_mobile_raw`);
        const finalPathNoExt = path.join(config.paths.temp, `${mediaId}_mobile_final`);

        try {
          const response = await fetch(m.url);
          if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`);
          const contentType = response.headers.get('content-type') ?? '';
          const isVideo = contentType.startsWith('video/');
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

          // Don't key the storage path on scraped.author.username either: the
          // same actor bug that mislabels media type also mis-parses the
          // username for postUrls scrapes of /reel/ and /p/ URLs — it takes
          // the URL's second path segment, which for those two forms is the
          // literal string "reel" or "p", not a real account. The path only
          // needs to be a stable, collision-free namespace, not the account.
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
