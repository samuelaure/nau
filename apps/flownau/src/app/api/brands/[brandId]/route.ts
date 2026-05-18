export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { logError } from '@/modules/shared/logger'
import { z } from 'zod'
import { recordPromptChange } from '@/modules/shared/prompt-history'

const BrandPatchSchema = z.object({
  autoApproveIdeas: z.boolean().optional(),
  coverageHorizonDays: z.number().int().min(1).max(30).optional(),
  ideationCustomPrompt: z.string().max(10000).nullable().optional(),
  draftCustomPrompt: z.string().max(10000).nullable().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    const denied = await checkBrandAccessForRoute(brandId)
    if (denied) return denied
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        ideationCustomPrompt: true,
        draftCustomPrompt: true,
        language: true,
        autoApproveIdeas: true,
        coverageHorizonDays: true,
      },
    })
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ brand })
  } catch (error) {
    logError('BRAND_GET', error)
    return NextResponse.json({ error: 'Failed to fetch brand' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const denied2 = await checkBrandAccessForRoute(brandId)
    if (denied2) return denied2

    const body = await req.json()
    const parsed = BrandPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const brand = await prisma.brand.update({
      where: { id: brandId },
      data: parsed.data,
    })

    if (parsed.data.ideationCustomPrompt !== undefined) {
      await recordPromptChange(
        'brand',
        brandId,
        'ideationCustomPrompt',
        parsed.data.ideationCustomPrompt,
      )
    }
    if (parsed.data.draftCustomPrompt !== undefined) {
      await recordPromptChange('brand', brandId, 'draftCustomPrompt', parsed.data.draftCustomPrompt)
    }

    return NextResponse.json({ brand })
  } catch (error) {
    logError('BRAND_PATCH', error)
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 })
  }
}
