import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'
import { logger } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) return unauthorizedCronResponse()

  const counts = await prisma.post.groupBy({
    by: ['status'],
    _count: { status: true },
  })

  const recent = await prisma.post.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: { id: true, status: true, format: true, scheduledAt: true, updatedAt: true },
  })

  return NextResponse.json({ statusCounts: counts, recent })
}

export async function POST(request: Request) {
  if (!validateCronSecret(request)) return unauthorizedCronResponse()

  try {
    const body = await request.json().catch(() => ({}))
    const specificIds: string[] | undefined = body.postIds

    const where = specificIds?.length
      ? { id: { in: specificIds }, status: { in: ['RENDERING', 'FAILED'] } }
      : { status: { in: ['RENDERING', 'FAILED'] } }

    const { count } = await prisma.post.updateMany({ where, data: { status: 'SCHEDULED' } })

    const posts = await prisma.post.findMany({
      where: specificIds?.length ? { id: { in: specificIds } } : { status: 'SCHEDULED' },
      select: { id: true },
    })

    if (posts.length > 0) {
      await prisma.renderJob.updateMany({
        where: { postId: { in: posts.map((p) => p.id) } },
        data: { status: 'pending', error: null },
      })
    }

    logger.info(`[ResetRenders] Reset ${count} post(s) back to SCHEDULED`)
    return NextResponse.json({ message: 'Reset complete', reset: count })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Reset failed', details: msg }, { status: 500 })
  }
}
