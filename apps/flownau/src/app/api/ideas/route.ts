// TODO: remove when confirmed unused — replaced by /api/posts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccess } from '@/modules/shared/actions'
import { resolveProvenance } from '@/modules/ideation/provenance'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')

    if (!brandId) {
      return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })
    }

    await checkBrandAccess(brandId)

    const ideas = await prisma.post.findMany({
      where: { brandId, status: { in: ['IDEA_PENDING', 'IDEA_APPROVED'] } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ideas }, { status: 200 })
  } catch (error) {
    console.error('[GET_IDEAS_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch ideas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { brandId, ideaText, source, status, format } = body

    if (!brandId || !ideaText) {
      return NextResponse.json({ error: 'Missing brandId or ideaText' }, { status: 400 })
    }

    await checkBrandAccess(brandId)

    let priority = 3
    if (source === 'captured') priority = 1
    if (source === 'manual') priority = 2

    const provenance = await resolveProvenance(brandId)

    const idea = await prisma.post.create({
      data: {
        brandId,
        ideaText,
        source: source || 'manual',
        status: status || 'IDEA_PENDING',
        priority,
        brandPersonaId: provenance.brandPersonaId,
      },
    })

    return NextResponse.json({ idea }, { status: 201 })
  } catch (error) {
    console.error('[POST_IDEAS_ERROR]', error)
    return NextResponse.json({ error: 'Failed to create idea' }, { status: 500 })
  }
}
