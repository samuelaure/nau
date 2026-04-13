export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@/auth'

/**
 * DEPRECATED: Template AI description was part of the old free-form JSON pipeline.
 * Replaced by scene-based composition in v2. This endpoint returns 410 Gone.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(
    { error: 'This endpoint has been deprecated. Use the scene-based composition pipeline.' },
    { status: 410 },
  )
}
