export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'

/**
 * POST /api/compositions/[id]/approve-post
 *
 * Phase 17: Manual Final Review gate.
 * Moves a RENDERED composition to PUBLISHING, authorizing the publisher cron
 * to publish it on its next run regardless of autoApprovePost setting.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const composition = await prisma.composition.findUnique({ where: { id } })
    if (!composition) {
      return NextResponse.json({ error: 'Composition not found' }, { status: 404 })
    }
    if (!['RENDERED', 'rendered'].includes(composition.status)) {
      return NextResponse.json(
        { error: 'Composition must be in RENDERED status to approve for posting' },
        { status: 422 },
      )
    }

    const updated = await prisma.composition.update({
      where: { id },
      data: { status: 'PUBLISHING' },
    })

    return NextResponse.json({ composition: updated }, { status: 200 })
  } catch (error) {
    console.error('[APPROVE_POST_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to approve composition for posting' },
      { status: 500 },
    )
  }
}
