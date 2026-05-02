export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { logError } from '@/modules/shared/logger'
import { z } from 'zod'
import { materializeSlots } from '@/modules/scheduling/slot-materializer'

const BrandPatchSchema = z.object({
  ideationCount: z.number().int().min(1).max(30).optional(),
  autoApproveIdeas: z.boolean().optional(),
  coverageHorizonDays: z.number().int().min(1).max(30).optional(),
  ideationPrompt: z.string().max(2000).nullable().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    const denied = await checkBrandAccessForRoute(brandId); if (denied) return denied
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, ideationPrompt: true, language: true, ideationCount: true, autoApproveIdeas: true, coverageHorizonDays: true },
    })
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ brand })
  } catch (error) {
    logError('BRAND_GET', error)
    return NextResponse.json({ error: 'Failed to fetch brand' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const denied2 = await checkBrandAccessForRoute(brandId); if (denied2) return denied2

    const body = await req.json()
    const parsed = BrandPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const brand = await prisma.brand.update({
      where: { id: brandId },
      data: parsed.data,
    })

    // Re-materialize slots when the coverage horizon changes so new slots
    // appear immediately without requiring a schedule re-save.
    if (parsed.data.coverageHorizonDays !== undefined) {
      await materializeSlots(brandId, parsed.data.coverageHorizonDays)
    }

    return NextResponse.json({ brand })
  } catch (error) {
    logError('BRAND_PATCH', error)
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 })
  }
}
