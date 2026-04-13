import { NextResponse } from 'next/server'
import { validateServiceKey, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { generateDailyPlan } from '@/modules/planning/daily-plan.service'
import { logError } from '@/modules/shared/logger'

/**
 * GET /api/v1/daily-plan/[accountId] — Get daily content plan.
 * Called by: Zazŭ
 * Auth: NAU_SERVICE_KEY
 *
 * Query params:
 *  - reminder=true: returns condensed version with only pending items
 */
export async function GET(req: Request, { params }: { params: Promise<{ accountId: string }> }) {
  if (!validateServiceKey(req)) {
    return unauthorizedResponse()
  }

  const { accountId } = await params
  const { searchParams } = new URL(req.url)
  const isReminder = searchParams.get('reminder') === 'true'

  try {
    const plan = await generateDailyPlan(accountId, new Date())

    if (isReminder) {
      // Condensed version: only pending items + alerts
      return NextResponse.json({
        date: plan.date,
        accountUsername: plan.accountUsername,
        pieces: plan.pieces.filter((p) =>
          ['draft', 'approved', 'rendering', 'rendered', 'scheduled'].includes(
            p.status.toLowerCase(),
          ),
        ),
        scripts: plan.scripts,
        alerts: plan.alerts,
        stats: plan.stats,
      })
    }

    return NextResponse.json(plan)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[DailyPlanAPI] Failed to generate plan', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
