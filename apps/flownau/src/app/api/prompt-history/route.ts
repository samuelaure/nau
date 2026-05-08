export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

/**
 * GET /api/prompt-history?entityType=X&entityId=Y&field=Z
 * Returns the full history for one prompt field, newest first.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const field = searchParams.get('field')

  if (!entityType || !entityId || !field) {
    return NextResponse.json({ error: 'Missing entityType, entityId or field' }, { status: 400 })
  }

  const entries = await prisma.promptHistory.findMany({
    where: { entityType, entityId, field },
    orderBy: { activeSince: 'desc' },
  })

  return NextResponse.json({ entries })
}
