export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkBrandAccess } from '@/modules/shared/actions'
import { runCoverageChecks } from '@/modules/scheduling/coverage.service'
import { logError } from '@/modules/shared/logger'

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    await checkBrandAccess(brandId)
    const result = await runCoverageChecks(brandId)
    return NextResponse.json({ result })
  } catch (error) {
    logError('COVERAGE_TRIGGER', error)
    return NextResponse.json({ error: 'Coverage check failed' }, { status: 500 })
  }
}
