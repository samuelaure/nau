export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'
import { checkBrandAccess } from '@/modules/shared/actions'
import { logError } from '@/modules/shared/logger'
import { materializeSlots } from '@/modules/scheduling/slot-materializer'

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await checkBrandAccess(brandId)

    // Materialize slots on-demand so new brands see projections immediately
    const schedule = await prisma.postSchedule.findUnique({ where: { brandId }, select: { isActive: true } })
    if (schedule?.isActive) {
      materializeSlots(brandId, 31).catch(() => {})
    }

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    // Default window: past 7 days → next 30 days
    const defaultFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const defaultTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const slots = await prisma.postSlot.findMany({
      where: {
        brandId,
        scheduledAt: {
          gte: from ? new Date(from) : defaultFrom,
          lte: to ? new Date(to) : defaultTo,
        },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        post: {
          select: {
            id: true,
            status: true,
            format: true,
            caption: true,
            scheduledAt: true,
            createdAt: true,
            userUploadedMediaUrl: true,
          },
        },
      },
    })

    return NextResponse.json({ slots })
  } catch (error) {
    logError('SLOTS_GET', error)
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 })
  }
}
