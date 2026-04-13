import { NextResponse } from 'next/server'
import { validateServiceKey, unauthorizedResponse } from '@/modules/shared/nau-auth'

/**
 * GET /api/v1/daily-plan/[accountId] — Get daily content plan.
 * Called by: Zazŭ
 * Auth: NAU_SERVICE_KEY
 *
 * Phase 5 will implement the full daily plan generation.
 */
export async function GET(req: Request, { params }: { params: Promise<{ accountId: string }> }) {
  if (!validateServiceKey(req)) {
    return unauthorizedResponse()
  }

  const { accountId } = await params

  return NextResponse.json(
    { error: `Daily plan for account ${accountId} not implemented. Available in Phase 5.` },
    { status: 501 },
  )
}
