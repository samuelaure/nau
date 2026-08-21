import { Queue } from 'bullmq';
import { config } from '../config';

/**
 * Reprocesses a single Instagram post by URL for naŭ mobile — distinct from the
 * ingestion→download→optimization→compute pipeline, which is built around a whole
 * profile scraped in one ScrapingRun. These jobs are one post at a time, from
 * whatever account it belongs to, with no downstream transcription/synthesis step.
 * See nau-mobile/docs/reprocessing-pipeline.md.
 */
export const mobileReprocessQueue = new Queue('mobile-reprocess-queue', {
  connection: config.redis,
  defaultJobOptions: {
    removeOnComplete: { count: 200, age: 7 * 24 * 3600 },
    removeOnFail: { count: 500 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});
