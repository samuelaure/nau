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
    const denied = await checkBrandAccessForRoute(brandId)
    if (denied) return denied

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { coverageHorizonDays: true },
    })
    const horizonDays = brand?.coverageHorizonDays ?? 7
    const defaultFrom = new Date()
    const defaultTo = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000)

    // Return scheduled posts in the same shape the calendar UI expects.
    // status mapping: PUBLISHED → "published", anything else with scheduledAt → "filled"
    const posts = await prisma.post.findMany({
      where: {
        brandId,
        scheduledAt: {
          gte: from ? new Date(from) : defaultFrom,
          lte: to ? new Date(to) : defaultTo,
        },
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        status: true,
        format: true,
        caption: true,
        scheduledAt: true,
        createdAt: true,
        userUploadedMediaUrl: true,
      },
    })

    const slots = posts.map((p) => ({
      id: p.id,
      scheduledAt: p.scheduledAt!.toISOString(),
      format: p.format ?? '',
      status: p.status === 'PUBLISHED' ? 'published' : 'filled',
      post: {
        id: p.id,
        status: p.status,
        format: p.format,
        caption: p.caption,
        scheduledAt: p.scheduledAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        userUploadedMediaUrl: p.userUploadedMediaUrl,
      },
    }))

    return NextResponse.json({ slots })
  } catch (error) {
    logError('SLOTS_GET', error)
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 })
  }
}
