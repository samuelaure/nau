import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { addRenderJob } from '@/modules/renderer/render-queue'
import { logError, logger } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const USER_MANAGED_FORMATS = new Set(['head_talk', 'replicate'])

export async function GET(request: Request) {
  if (!validateCronSecret(request)) return unauthorizedCronResponse()

  try {
    const now = new Date()
    const advanceWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const scheduled = await prisma.post.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: advanceWindow },
      },
      include: { renderJob: true },
    })

    const results: Array<{ postId: string; status: string; jobId?: string }> = []

    for (const post of scheduled) {
      if (USER_MANAGED_FORMATS.has(post.format ?? '') && !post.userUploadedMediaUrl) {
        results.push({ postId: post.id, status: 'awaiting_user_media' })
        continue
      }

      if (post.renderJob && ['queued', 'rendering', 'uploading', 'done'].includes(post.renderJob.status)) {
        results.push({ postId: post.id, status: 'already_queued' })
        continue
      }

      try {
        const jobId = await addRenderJob(post.id)
        await prisma.post.update({ where: { id: post.id }, data: { status: 'RENDERING' } })
        logger.info(`[Renderer Cron] Enqueued ${post.id} (format=${post.format}, scheduledAt=${post.scheduledAt?.toISOString()})`)
        results.push({ postId: post.id, status: 'enqueued', jobId })
      } catch (err) {
        logError(`[Renderer Cron] Failed to enqueue ${post.id}`, err)
        results.push({ postId: post.id, status: 'error' })
      }
    }

    return NextResponse.json({ message: 'Renderer cron complete', checked: scheduled.length, results })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Renderer Cron] Fatal error', error)
    return NextResponse.json({ error: 'Renderer cron failure', details: msg }, { status: 500 })
  }
}
