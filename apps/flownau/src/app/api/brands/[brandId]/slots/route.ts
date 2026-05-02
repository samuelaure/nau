export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { logError } from '@/modules/shared/logger'

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const denied = await checkBrandAccessForRoute(brandId); if (denied) return denied

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    // Default window: today → coverageHorizonDays ahead
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { coverageHorizonDays: true },
    })
    const horizonDays = brand?.coverageHorizonDays ?? 7
    const defaultFrom = new Date()
    const defaultTo = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000)

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
