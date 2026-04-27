// TODO: remove when confirmed unused — replaced by /api/posts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccess } from '@/modules/shared/actions'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')

    if (!brandId) {
      return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })
    }

    await checkBrandAccess(brandId)

    const isCalendar = searchParams.get('calendar') === '1'
    const isPool = searchParams.get('pool') === '1'
    const statusFilter = searchParams.get('status')

    const whereClause = isCalendar
      ? {
          brandId,
          status: { in: ['APPROVED', 'SCHEDULED', 'RENDERING', 'RENDERED'] },
        }
      : isPool
        ? {
            brandId,
            status: { in: ['DRAFT', 'APPROVED'] },
            scheduledAt: null,
          }
        : statusFilter
          ? { brandId, status: statusFilter }
          : { brandId }

    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy: isCalendar ? { scheduledAt: 'asc' } : { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, sceneType: true } },
        renderJob: { select: { outputUrl: true, outputType: true, status: true } },
      },
    })

    const mapped = posts.map((p) => ({
      ...p,
      renderedVideoUrl: p.renderJob?.outputUrl ?? null,
    }))

    return NextResponse.json({ compositions: mapped }, { status: 200 })
  } catch (error) {
    console.error('[GET_COMPOSITIONS_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch compositions' }, { status: 500 })
  }
}
