import { NextResponse } from 'next/server'
import { runAutonomousScheduler } from '@/modules/scheduling/scheduling.service'
import { logError } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/scheduler
 *
 * Phase 18: AI planner-strategist orders APPROVED compositions, then a rule-based
 * slot calculator assigns each to the next matching HH:MM slot from the default
 * ContentPlanner. If ContentPlanner.autoApproveSchedule is true the composition
 * advances to SCHEDULED (authorizing advance rendering); otherwise it retains
 * APPROVED with a suggested scheduledAt.
 */
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const { slotted, autoScheduled } = await runAutonomousScheduler()
    return NextResponse.json({
      message: 'Scheduler run complete',
      slotted,
      autoScheduled,
      suggested: slotted - autoScheduled,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Scheduler Cron] Fatal error', error)
    return NextResponse.json({ error: 'Scheduler failure', details: msg }, { status: 500 })
  }
}
