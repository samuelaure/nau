export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkAccountAccess } from '@/modules/shared/actions'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
    }

    await checkAccountAccess(accountId)

    const isCalendar = searchParams.get('calendar') === '1'
    const isPool = searchParams.get('pool') === '1'
    const statusFilter = searchParams.get('status')

    const whereClause = isCalendar
      ? {
          accountId,
          status: { in: ['APPROVED', 'SCHEDULED', 'RENDERING', 'RENDERED'] },
        }
      : isPool
        ? {
            accountId,
            status: { in: ['DRAFT', 'APPROVED'] },
            scheduledAt: null,
          }
        : statusFilter
          ? { accountId, status: statusFilter }
          : { accountId }

    const compositions = await prisma.composition.findMany({
      where: whereClause,
      orderBy: isCalendar ? { scheduledAt: 'asc' } : { createdAt: 'desc' },
      include: {
        template: {
          select: { name: true },
        },
        renderJob: {
          select: { outputUrl: true, outputType: true, status: true },
        },
      },
    })

    const mapped = compositions.map((c) => ({
      ...c,
      renderedVideoUrl: c.renderJob?.outputUrl ?? null,
    }))
      },
    })

    return NextResponse.json({ compositions: mapped }, { status: 200 })
  } catch (error) {
    console.error('[GET_COMPOSITIONS_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch compositions' }, { status: 500 })
  }
}
