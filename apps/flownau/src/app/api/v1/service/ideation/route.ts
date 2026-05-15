import type { Prisma } from '@/generated/prisma'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { renderBrandContextBlock } from '@/modules/prompts/brand-context'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { logError } from '@/modules/shared/logger'

export async function POST(req: Request) {
  if (!(await validateServiceToken(req))) return unauthorizedResponse()

  try {
    const { brandId, topic, sourceRef } = await req.json()

    if (!brandId || !topic) {
      return NextResponse.json({ error: 'Missing brandId or topic' }, { status: 400 })
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { language: true, ideationCustomPrompt: true, name: true, context: true, autoApproveIdeas: true },
    })

    const language = brand?.language ?? 'Spanish'
    const brandContext = renderBrandContextBlock({ name: brand?.name ?? null, context: brand?.context ?? null }) || null

    const output = await generateContentIdeas({
      topic,
      language,
      userInstructions: brand?.ideationCustomPrompt ?? null,
      brandContext,
    })

    const batchId = crypto.randomUUID()
    const autoApprove = brand?.autoApproveIdeas ?? false

    const ideas = await Promise.all(
      output.ideas.map((idea) =>
        prisma.post.create({
          data: {
            brandId,
            ideaText: idea.concept,
            angle: idea.angle,
            status: autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING',
            source: 'capture',
            priority: 1,
            sourceRef: sourceRef ?? null,
            generationBatchId: batchId,
            llmTrace: { ideaTrace: output.trace } as unknown as Prisma.InputJsonValue,
          },
        }),
      ),
    )

    return NextResponse.json({ ideas, summary: output.briefSummary }, { status: 200 })
  } catch (error) {
    logError('SERVICE_IDEATION_ROUTE_ERROR', error)
    return NextResponse.json({ error: 'Failed to generate ideas' }, { status: 500 })
  }
}
