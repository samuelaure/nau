import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'
import { logger } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/reset-renders
 *
 * Admin operation: resets RENDERING or FAILED compositions back to SCHEDULED
 * so the renderer cron can re-enqueue them. Also resets their renderJob status.
 *
 * Optional body: { compositionIds?: string[] } to reset specific IDs only.
 * GET: returns current status counts for all compositions.
 */
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  const counts = await prisma.composition.groupBy({
    by: ['status'],
    _count: { status: true },
  })

  const recent = await prisma.composition.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: { id: true, status: true, format: true, scheduledAt: true, updatedAt: true },
  })

  return NextResponse.json({ statusCounts: counts, recent })
}

export async function POST(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const body = await request.json().catch(() => ({}))
    const specificIds: string[] | undefined = body.compositionIds

    const where = specificIds?.length
      ? { id: { in: specificIds }, status: { in: ['RENDERING', 'failed', 'FAILED'] } }
      : { status: { in: ['RENDERING', 'failed', 'FAILED'] } }

    const { count } = await prisma.composition.updateMany({
      where,
      data: { status: 'SCHEDULED' },
    })

    // Also reset their render jobs so they can be re-upserted
    const comps = await prisma.composition.findMany({
      where: specificIds?.length ? { id: { in: specificIds } } : { status: 'SCHEDULED' },
      select: { id: true },
    })

    if (comps.length > 0) {
      await prisma.renderJob.updateMany({
        where: { compositionId: { in: comps.map((c) => c.id) } },
        data: { status: 'pending', error: null },
      })
    }

    logger.info(`[ResetRenders] Reset ${count} composition(s) back to SCHEDULED`)

    return NextResponse.json({ message: 'Reset complete', reset: count })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Reset failed', details: msg }, { status: 500 })
  }
}
