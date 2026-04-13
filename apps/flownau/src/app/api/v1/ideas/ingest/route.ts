import { NextResponse } from 'next/server'
import { validateServiceKey, unauthorizedResponse } from '@/modules/shared/nau-auth'

/**
 * POST /api/v1/ideas/ingest — Bulk ingest content ideas from external sources.
 * Called by: 9naŭ API (triage module)
 * Auth: NAU_SERVICE_KEY
 *
 * Phase 5 will implement the full ingest pipeline with deduplication.
 */
export async function POST(req: Request) {
  if (!validateServiceKey(req)) {
    return unauthorizedResponse()
  }

  return NextResponse.json(
    { error: 'Not implemented. Idea ingest pipeline will be available in Phase 5.' },
    { status: 501 },
  )
}
