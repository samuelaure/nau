import { Worker, type Job } from 'bullmq'
import { logger, logError } from '@/modules/shared/logger'
import { prisma } from '@/modules/shared/prisma'
import { redisConnection, type OptimizationJobData } from './optimization-queue'
import { optimizeAsset } from './optimize'

const CONCURRENCY = parseInt(process.env.OPTIMIZATION_CONCURRENCY || '1', 10)

async function processOptimizationJob(job: Job<OptimizationJobData>): Promise<void> {
  const { assetId } = job.data
  logger.info({ assetId, jobId: job.id, attempt: job.attemptsMade + 1 }, '[OptimizationWorker] Processing job')
  await optimizeAsset(job.data)
}

function handleFailedJob(job: Job<OptimizationJobData> | undefined, error: Error): void {
  if (!job) return
  const { assetId } = job.data
  logError(`[OptimizationWorker] Job ${job.id} failed`, error)
  if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
    prisma.asset
      .update({ where: { id: assetId }, data: { optimizationStatus: 'failed' } })
      .catch((dbErr) => logError('[OptimizationWorker] Failed to mark asset failed in DB', dbErr))
  }
}

export function startOptimizationWorker(): Worker<OptimizationJobData> {
  const worker = new Worker<OptimizationJobData>('flownau-optimization', processOptimizationJob, {
    connection: redisConnection,
    concurrency: CONCURRENCY,
  })

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, assetId: job.data.assetId }, '[OptimizationWorker] Job completed')
  })
  worker.on('failed', (job, error) => { handleFailedJob(job, error) })
  worker.on('error', (error) => { logError('[OptimizationWorker] Worker error', error) })

  logger.info({ concurrency: CONCURRENCY }, '[OptimizationWorker] Started, listening for jobs...')
  return worker
}
