export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { smartFillCalendar } from '@/modules/scheduling/coverage.service'
import { logError } from '@/modules/shared/logger'

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    const denied = await checkBrandAccessForRoute(brandId); if (denied) return denied
    const result = await smartFillCalendar(brandId)
    return NextResponse.json({ result })
  } catch (error) {
    logError('FILL_CALENDAR', error)
    return NextResponse.json({ error: 'Fill calendar failed' }, { status: 500 })
  }
}
