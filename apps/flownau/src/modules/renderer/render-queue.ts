import { Queue, type ConnectionOptions } from 'bullmq'
import { logger } from '@/modules/shared/logger'

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

const QUEUE_NAME = 'flownau-render'

export const renderQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
})

export interface RenderJobData {
  postId: string
}

export async function addRenderJob(postId: string, priority?: number): Promise<string> {
  const job = await renderQueue.add('render', { postId } satisfies RenderJobData, {
    jobId: `render-${postId}`,
    priority: priority ?? 10,
  })
  logger.info(`[RenderQueue] Enqueued render job ${job.id} for post ${postId}`)
  return job.id ?? postId
}

export async function getRenderJobStatus(postId: string): Promise<{
  state: string
  progress: number
  failedReason?: string
}> {
  const job = await renderQueue.getJob(`render-${postId}`)
  if (!job) return { state: 'unknown', progress: 0 }
  const state = await job.getState()
  const progress = typeof job.progress === 'number' ? job.progress : 0
  return { state, progress, failedReason: job.failedReason ?? undefined }
}
