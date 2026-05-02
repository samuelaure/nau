import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { logError } from '@/modules/shared/logger'

// Stage filters mapped to status values
const STAGE_FILTERS: Record<string, string[]> = {
  idea:      ['IDEA_PENDING', 'IDEA_APPROVED'],
  draft:     ['DRAFT_PENDING', 'DRAFT_APPROVED'],
  scheduled: ['SCHEDULED'],
  rendering: ['RENDERING', 'RENDERED_PENDING', 'RENDERED_APPROVED'],
  published: ['PUBLISHED'],
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')
    const stage = searchParams.get('stage')
    const status = searchParams.get('status')

    if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })
    const denied = await checkBrandAccessForRoute(brandId); if (denied) return denied

    const statusFilter = status
      ? [status]
      : stage && STAGE_FILTERS[stage]
        ? STAGE_FILTERS[stage]
        : undefined

    const posts = await prisma.post.findMany({
      where: {
        brandId,
        ...(statusFilter ? { status: { in: statusFilter } } : {}),
      },
      include: {
        template: { select: { id: true, name: true, sceneType: true } },
        renderJob: { select: { outputUrl: true, outputType: true, status: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ posts })
  } catch (error) {
    logError('GET /api/posts', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { brandId, ideaText, source = 'manual', status: initialStatus } = body

    if (!brandId || !ideaText?.trim()) {
      return NextResponse.json({ error: 'brandId and ideaText are required' }, { status: 400 })
    }
    const denied2 = await checkBrandAccessForRoute(brandId); if (denied2) return denied2

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { autoApproveIdeas: true, language: true },
    })

    const priority = source === 'capture' ? 1 : source === 'manual' ? 2 : 3
    const autoApprove = brand?.autoApproveIdeas ?? false
    const status = initialStatus ?? (autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING')

    const post = await prisma.post.create({
      data: {
        brandId,
        ideaText: ideaText.trim(),
        language: brand?.language ?? 'Spanish',
        source,
        priority,
        status,
      },
    })

    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    logError('POST /api/posts', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
