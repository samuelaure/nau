import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';

const connection = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const outboundQueue = new Queue('outbound-messages', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

export const inboundQueue = new Queue('inbound-processing', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
});

export const initWorkers = () => {
  const outboundWorker = new Worker(
    'outbound-messages',
    async (job: Job) => {
      logger.info(`Processing outbound message job ${job.id}`);
      // TODO: Use Provider to send message
      // const provider = ProviderFactory.getProvider();
      // await provider.sendMessage(job.data);
    },
    { connection }
  );

  const inboundWorker = new Worker(
    'inbound-processing',
    async (job: Job) => {
      logger.info(`Processing inbound message job ${job.id}`);
      // TODO: Process inbound message (AI analysis, etc.)
    },
    { connection }
  );

  outboundWorker.on('completed', (job) => {
    logger.info(`Outbound job ${job.id} completed`);
  });

  outboundWorker.on('failed', (job, err) => {
    logger.error(`Outbound job ${job?.id} failed: ${err.message}`);
  });

  inboundWorker.on('completed', (job) => {
    logger.info(`Inbound job ${job.id} completed`);
  });

  inboundWorker.on('failed', (job, err) => {
    logger.error(`Inbound job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Queue workers initialized');
};
