import { Queue, type ConnectionOptions } from 'bullmq'
import { logger } from '@/modules/shared/logger'
import { prisma } from '@/modules/shared/prisma'

// Formats that require user-uploaded media instead of Remotion rendering.
const USER_MANAGED_FORMATS = new Set(['head_talk', 'replicate'])

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

/**
 * Event-driven render trigger. Call whenever a post transitions into
 * DRAFT_APPROVED. For user-managed formats (head_talk, replicate) it does
 * nothing — the user uploads media manually. Otherwise it flips the post to
 * RENDERING and enqueues a render job.
 */
export async function triggerRenderForPost(postId: string): Promise<{ enqueued: boolean; reason?: string }> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, format: true, userUploadedMediaUrl: true },
  })
  if (!post) return { enqueued: false, reason: 'not_found' }

  if (USER_MANAGED_FORMATS.has(post.format ?? '')) {
    return { enqueued: false, reason: 'user_managed_format' }
  }

  await prisma.post.update({ where: { id: postId }, data: { status: 'RENDERING' } })
  await addRenderJob(postId)
  logger.info({ postId, format: post.format }, '[RenderQueue] Render triggered for approved draft')
  return { enqueued: true }
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
