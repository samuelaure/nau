export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { logError } from '@/modules/shared/logger'
import { z } from 'zod'

const ScheduleUpsertSchema = z.object({
  formatChain: z.array(z.string()).min(1),
  dailyFrequency: z.number().int().min(1).max(10),
  windowStart: z.string().regex(/^\d{2}:\d{2}$/),
  windowEnd: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
  isActive: z.boolean().optional().default(true),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const denied = await checkBrandAccessForRoute(brandId); if (denied) return denied

    const schedule = await prisma.postSchedule.findUnique({ where: { brandId } })
    return NextResponse.json({ schedule })
  } catch (error) {
    logError('SCHEDULE_GET', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const denied2 = await checkBrandAccessForRoute(brandId); if (denied2) return denied2

    const body = await req.json()
    const parsed = ScheduleUpsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const schedule = await prisma.postSchedule.upsert({
      where: { brandId },
      create: { brandId, ...parsed.data },
      update: parsed.data,
    })

    return NextResponse.json({ schedule })
  } catch (error) {
    logError('SCHEDULE_PUT', error)
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 })
  }
}
