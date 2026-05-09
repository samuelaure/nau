import { Queue, type ConnectionOptions } from 'bullmq'

function getRedisConnection(): ConnectionOptions {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL }
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  }
}

export const redisConnection = getRedisConnection()

export interface OptimizationJobData {
  assetId: string
  cdnUrl: string
  type: 'VID' | 'AUD' | 'IMG'
  mimeType: string
  ext: string
  contextAccountId: string | null
  templateId: string | null
  assetFolder: 'videos' | 'audios' | 'images'
}

export const optimizationQueue = new Queue<OptimizationJobData>('flownau-optimization', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
})

export async function enqueueOptimization(data: OptimizationJobData): Promise<void> {
  await optimizationQueue.add('optimize', data, {
    jobId: `optimize-${data.assetId}`,
  })
}
