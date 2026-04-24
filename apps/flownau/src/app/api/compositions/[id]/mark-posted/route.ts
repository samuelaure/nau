export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'

/**
 * POST /api/compositions/[id]/mark-posted
 *
 * Phase 18: for user-managed formats (head_talk, replicate) — user indicates they
 * published the content externally. Sets status → PUBLISHED without flownaŭ posting.
 *
 * Body: { externalPostUrl?: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const externalPostUrl: string | undefined = body.externalPostUrl

    const composition = await prisma.composition.findUnique({ where: { id } })
    if (!composition) {
      return NextResponse.json({ error: 'Composition not found' }, { status: 404 })
    }

    const USER_MANAGED_FORMATS = new Set(['head_talk', 'replicate'])
    if (!USER_MANAGED_FORMATS.has(composition.format)) {
      return NextResponse.json(
        { error: 'mark-posted is only allowed for head_talk and replicate formats' },
        { status: 422 },
      )
    }

    const updated = await prisma.composition.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        userPostedManually: true,
        externalPostUrl: externalPostUrl ?? composition.externalPostUrl,
      },
    })

    return NextResponse.json({ composition: updated }, { status: 200 })
  } catch (error) {
    console.error('[MARK_POSTED_ERROR]', error)
    return NextResponse.json({ error: 'Failed to mark composition as posted' }, { status: 500 })
  }
}
