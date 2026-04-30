import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { addRenderJob, renderQueue } from '@/modules/renderer/render-queue'
import { logError, logger } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const USER_MANAGED_FORMATS = new Set(['head_talk', 'replicate'])

// A render job that has been in RENDERING for longer than this is considered stale.
const RENDER_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

export async function GET(request: Request) {
  if (!validateCronSecret(request)) return unauthorizedCronResponse()

  try {
    const resetResults: Array<{ postId: string; reason: string }> = []

    // ── Stale-render sweep ────────────────────────────────────────────────────
    // Posts stuck in RENDERING with no active BullMQ job (failed / lost) get
    // reset to DRAFT_PENDING so the user can re-approve and retry.
    const staleThreshold = new Date(Date.now() - RENDER_TIMEOUT_MS)
    const renderingPosts = await prisma.post.findMany({
      where: { status: 'RENDERING', updatedAt: { lt: staleThreshold } },
      select: { id: true, format: true, updatedAt: true },
    })

    for (const post of renderingPosts) {
      try {
        const job = await renderQueue.getJob(`render-${post.id}`)
        const jobState = job ? await job.getState() : null

        // Active states — job is still legitimately running
        if (jobState && ['active', 'waiting', 'delayed'].includes(jobState)) {
          continue
        }

        // Job is gone, failed, or unknown — reset post so user can retry
        await prisma.post.update({
          where: { id: post.id },
          data: { status: 'DRAFT_PENDING' },
        })
        // Clean up the dead render job record if it exists
        await prisma.renderJob.deleteMany({ where: { postId: post.id } })

        const reason = jobState ?? 'no_job'
        logger.warn({ postId: post.id, jobState: reason }, '[Renderer Cron] Reset stale RENDERING post')
        resetResults.push({ postId: post.id, reason })
      } catch (err) {
        logError(`[Renderer Cron] Failed to reset stale post ${post.id}`, err)
      }
    }

    // ── Safety-net enqueue ────────────────────────────────────────────────────
    // Catches DRAFT_APPROVED posts that slipped through the event-driven trigger
    // (e.g. server restart between approval and queue write).
    const drafts = await prisma.post.findMany({
      where: { status: 'DRAFT_APPROVED' },
      include: { renderJob: true },
    })

    const enqueueResults: Array<{ postId: string; status: string; jobId?: string }> = []

    for (const post of drafts) {
      if (USER_MANAGED_FORMATS.has(post.format ?? '') && !post.userUploadedMediaUrl) {
        enqueueResults.push({ postId: post.id, status: 'awaiting_user_media' })
        continue
      }

      if (post.renderJob && ['queued', 'rendering', 'uploading', 'done'].includes(post.renderJob.status)) {
        enqueueResults.push({ postId: post.id, status: 'already_queued' })
        continue
      }

      try {
        const jobId = await addRenderJob(post.id)
        await prisma.post.update({ where: { id: post.id }, data: { status: 'RENDERING' } })
        logger.info(`[Renderer Cron] Enqueued ${post.id} (format=${post.format})`)
        enqueueResults.push({ postId: post.id, status: 'enqueued', jobId })
      } catch (err) {
        logError(`[Renderer Cron] Failed to enqueue ${post.id}`, err)
        enqueueResults.push({ postId: post.id, status: 'error' })
      }
    }

    return NextResponse.json({
      message: 'Renderer cron complete',
      staleReset: resetResults.length,
      resetDetails: resetResults,
      checked: drafts.length,
      results: enqueueResults,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Renderer Cron] Fatal error', error)
    return NextResponse.json({ error: 'Renderer cron failure', details: msg }, { status: 500 })
  }
}
