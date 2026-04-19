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

    const whereClause = isCalendar
      ? {
          accountId,
          status: { in: ['APPROVED', 'SCHEDULED', 'RENDERING', 'RENDERED'] },
        }
      : { accountId }

    const compositions = await prisma.composition.findMany({
      where: whereClause,
      orderBy: isCalendar ? { scheduledAt: 'asc' } : { createdAt: 'desc' },
      include: {
        template: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json({ compositions }, { status: 200 })
  } catch (error) {
    console.error('[GET_COMPOSITIONS_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch compositions' }, { status: 500 })
  }
}
