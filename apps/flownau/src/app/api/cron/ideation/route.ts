import type { Prisma } from '@/generated/prisma'
import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { renderBrandContextBlock } from '@/modules/prompts/brand-context'
import {
  fetchPendingSourceConcepts,
  generateSourceConcepts,
  markSourceConceptConsumed,
} from '@/modules/ideation/sources/inspo-source'
import { logError, logger } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const results: Array<{
      brandId: string
      status: string
      ideasGenerated?: number
      conceptsProcessed?: number
      error?: string
    }> = []

    const accounts = await prisma.socialProfile.findMany({ take: 10 })

    for (const account of accounts) {
      // Skip if pending ideas exist — only generate when pipeline is exhausted
      const pendingIdeasCount = await prisma.post.count({
        where: { brandId: account.id, status: { in: ['IDEA_PENDING', 'IDEA_APPROVED'] } },
      })
      if (pendingIdeasCount > 0) continue

      try {
        const brand = await prisma.brand.findUnique({
          where: { id: account.brandId },
          select: { language: true, ideationCount: true, autoApproveIdeas: true, ideationCustomPrompt: true, name: true, context: true },
        })

        const language = brand?.language ?? 'Spanish'
        const count = brand?.ideationCount ?? undefined
        const autoApprove = brand?.autoApproveIdeas ?? false
        const brandContext = renderBrandContextBlock({ name: brand?.name ?? null, context: brand?.context ?? null }) || null

        // Recent content for diversity tracking
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        const recentPosts = await prisma.post.findMany({
          where: { brandId: account.id, createdAt: { gte: fourteenDaysAgo }, caption: { not: null } },
          select: { caption: true },
          take: 30,
        })
        const recentContent = recentPosts.map((p) => p.caption!.slice(0, 100))

        // Fetch pending source concepts; generate fresh ones if queue is empty
        let concepts = await fetchPendingSourceConcepts(account.brandId)
        if (concepts.length === 0) {
          logger.info(`[Ideation] No pending source concepts for ${account.id} — triggering generation`)
          concepts = await generateSourceConcepts(account.brandId)
        }

        if (concepts.length === 0) {
          logger.info(`[Ideation] Skipping ${account.id} — no source concepts available`)
          results.push({ brandId: account.id, status: 'skipped', error: 'No source concepts available' })
          continue
        }

        let totalIdeas = 0

        for (const concept of concepts) {
          try {
            const output = await generateContentIdeas({
              topic: concept.content,
              language,
              count,
              recentContent,
              userInstructions: brand?.ideationCustomPrompt ?? null,
              brandContext,
            })

            const batchId = crypto.randomUUID()
            await Promise.all(
              output.ideas.map((idea) =>
                prisma.post.create({
                  data: {
                    brandId: account.id,
                    ideaText: idea.concept,
                    angle: idea.angle,
                    status: autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING',
                    source: 'automatic',
                    priority: 3,
                    sourceRef: concept.id,
                    generationBatchId: batchId,
                    llmTrace: { ideaTrace: output.trace } as unknown as Prisma.InputJsonValue,
                  },
                }),
              ),
            )

            totalIdeas += output.ideas.length
            await markSourceConceptConsumed(concept.id)

            logger.info(`[Ideation] Concept ${concept.id}: generated ${output.ideas.length} ideas for ${account.username ?? account.id}`)
          } catch (err: unknown) {
            logError(`[Ideation] Failed on concept ${concept.id} for account ${account.id}`, err)
          }
        }

        results.push({
          brandId: account.id,
          status: 'success',
          ideasGenerated: totalIdeas,
          conceptsProcessed: concepts.length,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logError(`[Ideation] Failed for account ${account.id}`, err)
        results.push({ brandId: account.id, status: 'failed', error: msg })
      }
    }

    return NextResponse.json({ message: 'Ideation Execution Finished', results })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Ideation] Fatal error', error)
    return NextResponse.json({ error: 'Fatal ideation failure', details: msg }, { status: 500 })
  }
}
