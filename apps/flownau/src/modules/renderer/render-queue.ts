import { Queue, type ConnectionOptions } from 'bullmq'
import { logger } from '@/modules/shared/logger'

// ─── Redis Connection ──────────────────────────────────────────────

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

// ─── Queue ─────────────────────────────────────────────────────────

const QUEUE_NAME = 'flownau-render'

export const renderQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30_000, // 30s initial backoff
    },
    removeOnComplete: { count: 100 }, // Keep last 100 completed
    removeOnFail: { count: 200 }, // Keep last 200 failed for debugging
  },
})

// ─── Public API ────────────────────────────────────────────────────

export interface RenderJobData {
  compositionId: string
}

/**
 * Enqueue a composition for rendering.
 * Priority: lower number = higher priority (1 = highest).
 */
export async function addRenderJob(compositionId: string, priority?: number): Promise<string> {
  const job = await renderQueue.add('render', { compositionId } satisfies RenderJobData, {
    jobId: `render:${compositionId}`,
    priority: priority ?? 10,
  })

  logger.info(`[RenderQueue] Enqueued render job ${job.id} for composition ${compositionId}`)

  return job.id ?? compositionId
}

/**
 * Get aggregated render status for a composition.
 */
export async function getRenderJobStatus(compositionId: string): Promise<{
  state: string
  progress: number
  failedReason?: string
}> {
  const job = await renderQueue.getJob(`render:${compositionId}`)

  if (!job) {
    return { state: 'unknown', progress: 0 }
  }

  const state = await job.getState()
  const progress = typeof job.progress === 'number' ? job.progress : 0

  return {
    state,
    progress,
    failedReason: job.failedReason ?? undefined,
  }
}
