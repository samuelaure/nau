import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'
import { logger } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/approve-renders
 *
 * Admin/cron operation: bulk-moves RENDERED compositions to PUBLISHING,
 * authorizing the publisher cron to post them on next run.
 *
 * Optional body: { compositionIds?: string[] } to approve specific IDs only.
 * If omitted, all RENDERED compositions due within the next 48h are approved.
 */
export async function POST(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const body = await request.json().catch(() => ({}))
    const specificIds: string[] | undefined = body.compositionIds

    const where = specificIds?.length
      ? { id: { in: specificIds }, status: { in: ['RENDERED', 'rendered'] } }
      : {
          status: { in: ['RENDERED', 'rendered'] },
          scheduledAt: { lte: new Date(Date.now() + 48 * 60 * 60 * 1000) },
        }

    const { count } = await prisma.composition.updateMany({
      where,
      data: { status: 'PUBLISHING' },
    })

    logger.info(`[ApproveRenders] Approved ${count} composition(s) for publishing`)

    return NextResponse.json({ message: 'Approve renders complete', approved: count })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Approve renders failed', details: msg }, { status: 500 })
  }
}
