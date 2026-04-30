export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkBrandAccess } from '@/modules/shared/actions'
import { smartFillCalendar } from '@/modules/scheduling/coverage.service'
import { logError } from '@/modules/shared/logger'

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    await checkBrandAccess(brandId)
    const result = await smartFillCalendar(brandId)
    return NextResponse.json({ result })
  } catch (error) {
    logError('FILL_CALENDAR', error)
    return NextResponse.json({ error: 'Fill calendar failed' }, { status: 500 })
  }
}
