export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccess } from '@/modules/shared/actions'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { logError } from '@/modules/shared/logger'

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const {
      brandId,
      topic: topicFromBody,
      count: countOverride,
      source = 'manual',
    } = json

    if (!brandId) {
      return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })
    }

    await checkBrandAccess(brandId)

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { language: true, ideationCount: true, ideationPrompt: true },
    })

    const language = brand?.language ?? 'Spanish'
    const count = typeof countOverride === 'number' ? countOverride : (brand?.ideationCount ?? 9)

    // Resolve topic: for automatic source fetch digest from nauthenticity; for manual require it from body
    let topic: string = topicFromBody?.trim() ?? ''
    let sourceRef: string | null = null
    let priority = 2

    if (source === 'automatic') {
      const { fetchBrandDigest } = await import('@/modules/ideation/sources/inspo-source')
      const digest = await fetchBrandDigest(brandId)

      if (!digest?.content?.trim()) {
        return NextResponse.json(
          { error: 'No InspoBase digest available. Run a nauthenticity scrape first.' },
          { status: 422 },
        )
      }

      topic = digest.content
      priority = 3
      sourceRef =
        digest.attachedUrls.length > 0
          ? digest.attachedUrls.length === 1
            ? digest.attachedUrls[0]
            : JSON.stringify(digest.attachedUrls)
          : null
    }

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required.' }, { status: 400 })
    }

    // Recent content for diversity (manual skip for speed; cron handles this for automatic)
    const output = await generateContentIdeas({ topic, language, count, userInstructions: brand?.ideationPrompt ?? null })

    const autoApprove = (await prisma.brand.findUnique({ where: { id: brandId }, select: { autoApproveIdeas: true } }))?.autoApproveIdeas ?? false
    const batchId = crypto.randomUUID()

    const ops = output.ideas.map((idea) =>
      prisma.post.create({
        data: {
          brandId,
          ideaText: idea.concept,
          status: autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING',
          source,
          priority,
          sourceRef,
          generationBatchId: batchId,
        },
      }),
    )

    const generatedIdeas = await Promise.all(ops)

    return NextResponse.json(
      { ideas: generatedIdeas, summary: output.briefSummary },
      { status: 200 },
    )
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      typeof (error as any).digest === 'string' &&
      (error as any).digest.startsWith('NEXT_REDIRECT')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logError('IDEA_GENERATION_ROUTE_ERROR', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate ideas', message }, { status: 500 })
  }
}
