// TODO: remove when confirmed unused — replaced by /api/posts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccessForRoute } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')

    if (!brandId) {
      return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })
    }

    const denied = await checkBrandAccessForRoute(brandId); if (denied) return denied

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

    const denied2 = await checkBrandAccessForRoute(brandId); if (denied2) return denied2

    let priority = 3
    if (source === 'captured') priority = 1
    if (source === 'manual') priority = 2

    const idea = await prisma.post.create({
      data: {
        brandId,
        ideaText,
        source: source || 'manual',
        status: status || 'IDEA_PENDING',
        priority,
      },
    })

    return NextResponse.json({ idea }, { status: 201 })
  } catch (error) {
    console.error('[POST_IDEAS_ERROR]', error)
    return NextResponse.json({ error: 'Failed to create idea' }, { status: 500 })
  }
}
