import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { generateDailyPlan } from '@/modules/planning/daily-plan.service'
import { logError, logger } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * GET /api/cron/daily-plan
 *
 * Runs daily to generate tomorrow's content plan for each active account.
 * Called at configured evening hour (default 22:00).
 *
 * For each account:
 * 1. Generate tomorrow's content plan (pieces, scripts, alerts)
 * 2. Store in ContentPlan table
 */
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const results: Array<{
      brandId: string
      status: string
      piecesCount?: number
      scriptsCount?: number
      alertsCount?: number
      error?: string
    }> = []

    // Generate plans for tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const accounts = await prisma.socialProfile.findMany({
      where: { accessToken: { not: '' } },
      select: { id: true, username: true },
    })

    logger.info(`[DailyPlanCron] Generating plans for ${accounts.length} accounts`)

    for (const account of accounts) {
      try {
        const plan = await generateDailyPlan(account.id, tomorrow)

        results.push({
          brandId: account.id,
          status: 'success',
          piecesCount: plan.pieces.length,
          scriptsCount: plan.scripts.length,
          alertsCount: plan.alerts.length,
        })

        logger.info(
          `[DailyPlanCron] Plan generated for ${account.username ?? account.id}: ${plan.pieces.length} pieces, ${plan.scripts.length} scripts, ${plan.alerts.length} alerts`,
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logError(`[DailyPlanCron] Failed for account ${account.id}`, err)
        results.push({ brandId: account.id, status: 'failed', error: msg })
      }
    }

    return NextResponse.json({
      message: 'Daily Plan Cron Finished',
      date: tomorrow.toISOString().split('T')[0],
      results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[DailyPlanCron] Fatal error', error)
    return NextResponse.json({ error: 'Fatal daily plan failure', details: msg }, { status: 500 })
  }
}
