export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'
import { checkBrandAccess } from '@/modules/shared/actions'
import { logError } from '@/modules/shared/logger'
import { z } from 'zod'

const BrandPatchSchema = z.object({
  ideationCount: z.number().int().min(1).max(30).optional(),
  autoApproveIdeas: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await checkBrandAccess(brandId)

    const body = await req.json()
    const parsed = BrandPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const brand = await prisma.brand.update({
      where: { id: brandId },
      data: parsed.data,
    })

    return NextResponse.json({ brand })
  } catch (error) {
    logError('BRAND_PATCH', error)
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 })
  }
}
