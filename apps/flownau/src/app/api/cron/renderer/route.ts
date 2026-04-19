import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { addRenderJob } from '@/modules/renderer/render-queue'
import { logError, logger } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/renderer
 *
 * Phase 17: Advance Render Trigger.
 * Scans for SCHEDULED compositions whose scheduledAt falls within the next 48 hours
 * and enqueues them for rendering if not already queued/rendering.
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
          `[Renderer Cron] Enqueued ${comp.id} (scheduledAt=${comp.scheduledAt?.toISOString()})`,
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
