import { NextResponse } from 'next/server'
import { validateServiceKey, unauthorizedResponse } from '@/modules/shared/nau-auth'

/**
 * POST /api/v1/compose — Trigger reactive content composition.
 * Called by: 9naŭ API, Zazŭ
 * Auth: NAU_SERVICE_KEY
 *
 * Phase 2 will implement the full composition pipeline.
 */
export async function POST(req: Request) {
  if (!validateServiceKey(req)) {
    return unauthorizedResponse()
  }

  return NextResponse.json(
    { error: 'Not implemented. Scene composition pipeline will be available in Phase 2.' },
    { status: 501 },
  )
}
