import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { addRenderJob } from '@/modules/renderer/render-queue'
import { logError, logger } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Phase 18: user-managed formats never run through the Remotion renderer.
// They sit in SCHEDULED until the user uploads media (→ RENDERED) or marks as posted.
const USER_MANAGED_FORMATS = new Set(['head_talk', 'replicate'])

/**
 * GET /api/cron/renderer
 *
 * Phase 18: Advance Render Trigger.
 * Scans for SCHEDULED compositions whose scheduledAt falls within the next 48 hours.
 * - head_talk / replicate with no userUploadedMediaUrl → skipped (awaiting user action).
 * - head_talk / replicate with userUploadedMediaUrl → enqueued as a passthrough job.
 * - All other formats → enqueued for full Remotion render.
 */
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const now = new Date()
    const advanceWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const scheduled = await prisma.composition.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: advanceWindow },
      },
      include: { renderJob: true },
    })

    const results: Array<{ compositionId: string; status: string; jobId?: string }> = []

    for (const comp of scheduled) {
      // Phase 18: skip user-managed formats that have no uploaded media yet.
      if (USER_MANAGED_FORMATS.has(comp.format) && !comp.userUploadedMediaUrl) {
        results.push({ compositionId: comp.id, status: 'awaiting_user_media' })
        continue
      }

      // Skip if already queued or rendering
      if (
        comp.renderJob &&
        ['queued', 'rendering', 'uploading', 'done'].includes(comp.renderJob.status)
      ) {
        results.push({ compositionId: comp.id, status: 'already_queued' })
        continue
      }

      try {
        const jobId = await addRenderJob(comp.id)
        await prisma.composition.update({
          where: { id: comp.id },
          data: { status: 'RENDERING' },
        })
        logger.info(
          `[Renderer Cron] Enqueued ${comp.id} (format=${comp.format}, scheduledAt=${comp.scheduledAt?.toISOString()})`,
        )
        results.push({ compositionId: comp.id, status: 'enqueued', jobId })
      } catch (err) {
        logError(`[Renderer Cron] Failed to enqueue ${comp.id}`, err)
        results.push({ compositionId: comp.id, status: 'error' })
      }
    }

    return NextResponse.json({
      message: 'Renderer cron complete',
      checked: scheduled.length,
      results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Renderer Cron] Fatal error', error)
    return NextResponse.json({ error: 'Renderer cron failure', details: msg }, { status: 500 })
  }
}
