export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccess } from '@/modules/shared/actions'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { logError } from '@/modules/shared/logger'
import type { Prisma } from '@prisma/client'

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const {
      brandId,
      topic,
      count: countOverride,
      source = 'manual',
    } = json

    if (!brandId) {
      return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })
    }

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Topic is required.' }, { status: 400 })
    }

    await checkBrandAccess(brandId)

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { language: true, ideationCount: true },
    })

    const language = brand?.language ?? 'Spanish'
    const count = typeof countOverride === 'number' ? countOverride : (brand?.ideationCount ?? 9)

    // Determine source metadata
    let sourceRef: string | null = null
    let autoApprove = false
    let priority = 2

    if (source === 'automatic') {
      // Automatic source: topic comes from digest, sourceRef tracks it
      sourceRef = topic.length < 300 ? topic : null
      priority = 3
    }

    // Generate ideas
    const output = await generateContentIdeas({ topic, language, count })

    // Save ideas
    const ops = output.ideas.map((idea) =>
      prisma.contentIdea.create({
        data: {
          brandId,
          ideaText: idea.concept,
          format: null,
          status: autoApprove ? 'APPROVED' : 'PENDING',
          source,
          priority,
          sourceRef,
        },
      }),
    )

    const generatedIdeas = await Promise.all(ops)

    return NextResponse.json(
      {
        ideas: generatedIdeas,
        summary: output.briefSummary,
      },
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
