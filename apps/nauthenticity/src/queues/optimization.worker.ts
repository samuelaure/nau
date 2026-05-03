import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { prisma } from '../modules/shared/prisma';
import { logger } from '../utils/logger';
import { wlog } from '../utils/worker-logger';
import fs from 'fs';
import path from 'path';
import { createStorage, nauthenticity } from 'nau-storage';
import { optimizeImage, optimizeVideo } from '../utils/media';
import { computeQueue } from './compute.queue';
import { logContextStorage } from '../utils/context';

const storage = config.env.R2_ENDPOINT && config.env.R2_ACCESS_KEY_ID && config.env.R2_SECRET_ACCESS_KEY && config.env.R2_BUCKET_NAME && config.env.R2_PUBLIC_URL
  ? createStorage({
      endpoint: config.env.R2_ENDPOINT,
      accessKeyId: config.env.R2_ACCESS_KEY_ID,
      secretAccessKey: config.env.R2_SECRET_ACCESS_KEY,
      bucket: config.env.R2_BUCKET_NAME,
      publicUrl: config.env.R2_PUBLIC_URL,
      envPrefix: config.env.NODE_ENV,
    })
  : null;

interface OptimizeMediaData {
  runId: string;
  mediaId: string;
  username: string;
  rawUrl: string;
  type: 'image' | 'video';
  fileExt: string;
}

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const optimizationWorker = new Worker(
  'optimization-queue',
  async (job: Job<OptimizeMediaData>) => {
    return logContextStorage.run({ jobId: job.id, ...job.data }, async () => {
      if (job.name === 'optimize-media') {
        const { runId, mediaId, username, rawUrl, type, fileExt } = job.data;
        const rawStorageKey = nauthenticity.rawPost(username, mediaId, fileExt);
        const finalStorageKey = nauthenticity.post(username, mediaId, fileExt);

        wlog.optimize.start(username, mediaId, type, rawUrl, finalStorageKey);

        ensureDir(config.paths.temp);

        const tempRawPath = path.join(config.paths.temp, `${mediaId}_raw_opt.${fileExt}`);
        const tempOptimizedPath = path.join(config.paths.temp, `${mediaId}_final_opt.${fileExt}`);

        try {
          if (storage) {
            const response = await fetch(rawUrl);
            if (!response.ok) throw new Error(`Failed to fetch raw from R2: ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(tempRawPath, buffer);

            if (type === 'video') {
              await optimizeVideo(tempRawPath, tempOptimizedPath);
            } else {
              await optimizeImage(tempRawPath, tempOptimizedPath);
            }

            const publicUrl = await storage.upload(
              finalStorageKey,
              fs.createReadStream(tempOptimizedPath),
              { mimeType: type === 'video' ? 'video/mp4' : 'image/jpeg' },
            );

            await storage.delete(rawStorageKey);

            await prisma.media.update({
              where: { id: mediaId },
              data: { storageUrl: publicUrl },
            });

            wlog.optimize.done(mediaId, publicUrl);
          } else {
            // Fallback: local storage
            const localRawPath = path.join(
              config.paths.storage, 'raw', username, 'posts', `${mediaId}.${fileExt}`,
            );
            const finalLocalPath = path.join(
              config.paths.storage, username, 'posts', `${mediaId}.${fileExt}`,
            );

            if (fs.existsSync(localRawPath)) {
              if (type === 'video') {
                await optimizeVideo(localRawPath, tempOptimizedPath);
              } else {
                await optimizeImage(localRawPath, tempOptimizedPath);
              }
              ensureDir(path.dirname(finalLocalPath));
              fs.copyFileSync(tempOptimizedPath, finalLocalPath);
              fs.unlinkSync(localRawPath);
            }

            await prisma.media.update({
              where: { id: mediaId },
              data: { storageUrl: `/content/${username}/posts/${mediaId}.${fileExt}` },
            });
          }

          // 6. Check completion
          const countPendingOptimization = await prisma.media.count({
            where: { post: { runId }, storageUrl: { contains: '/raw/' } },
          });

          if (countPendingOptimization === 0) {
            const run = await prisma.scrapingRun.findUnique({ where: { id: runId } });
            if (run?.phase === 'optimizing') {
              wlog.phase('visualizing', runId, 'all optimized → starting visualize batch');
              await prisma.scrapingRun.update({
                where: { id: runId },
                data: { phase: 'visualizing' },
              });
              await computeQueue.add('visualize-batch', { runId, username });
            }
          }
        } catch (error) {
          wlog.optimize.error(mediaId, error);
          throw error;
        } finally {
          if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath);
          if (fs.existsSync(tempOptimizedPath)) fs.unlinkSync(tempOptimizedPath);
        }
      }
    });
  },
  { connection: config.redis, concurrency: 1 },
);

optimizationWorker.on('failed', (job, err) => {
  wlog.optimize.error(job?.id ?? '?', err.message);
});
