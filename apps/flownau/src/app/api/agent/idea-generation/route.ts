import type { Prisma } from '@/generated/prisma'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { renderBrandContextBlock } from '@/modules/prompts/brand-context'
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

    const denied = await checkBrandAccessForRoute(brandId); if (denied) return denied

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { language: true, ideationCount: true, ideationCustomPrompt: true, name: true, context: true },
    })

    const language = brand?.language ?? 'Spanish'
    const count = typeof countOverride === 'number' ? countOverride : (brand?.ideationCount ?? undefined)

    // Resolve topic: for automatic source fetch digest from nauthenticity; for manual require it from body
    let topic: string = topicFromBody?.trim() ?? ''
    let sourceRef: string | null = null
    let priority = 2

    if (source === 'capture') {
      // Service-delivered capture (voicenote, specific capture) — topic and sourceRef come from body
      if (!topic) {
        return NextResponse.json({ error: 'Topic is required for capture source.' }, { status: 400 })
      }
      priority = 1
      sourceRef = json.sourceRef ?? null
    } else if (source === 'automatic') {
      const { fetchPendingSourceConcepts, generateSourceConcepts } = await import('@/modules/ideation/sources/inspo-source')
      let concepts = await fetchPendingSourceConcepts(brandId)
      if (concepts.length === 0) concepts = await generateSourceConcepts(brandId)

      if (concepts.length === 0) {
        return NextResponse.json(
          { error: 'No source concepts available. Add posts or profiles to InspoBase first.' },
          { status: 422 },
        )
      }

      // Use the first pending concept as the topic for this brainstorm session
      topic = concepts[0].content
      priority = 3
      sourceRef = concepts[0].id
    }

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required.' }, { status: 400 })
    }

    // Recent content for diversity (manual skip for speed; cron handles this for automatic)
    const brandContext = renderBrandContextBlock({ name: brand?.name ?? null, context: brand?.context ?? null }) || null

    const output = await generateContentIdeas({
      topic,
      language,
      count,
      userInstructions: brand?.ideationCustomPrompt ?? null,
      brandContext,
    })

    const autoApprove = (await prisma.brand.findUnique({ where: { id: brandId }, select: { autoApproveIdeas: true } }))?.autoApproveIdeas ?? false
    const batchId = crypto.randomUUID()

    const ops = output.ideas.map((idea) =>
      prisma.post.create({
        data: {
          brandId,
          ideaText: idea.concept,
          angle: idea.angle,
          status: autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING',
          source,
          priority,
          sourceRef,
          generationBatchId: batchId,
          llmTrace: { ideaTrace: output.trace } as unknown as Prisma.InputJsonValue,
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
