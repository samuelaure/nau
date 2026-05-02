import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { fetchBrandDigest } from '@/modules/ideation/sources/inspo-source'
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
      summary?: string
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
        // Topic comes from nauthenticity digest — no digest = skip (no topic = blocked)
        const digest = await fetchBrandDigest(account.id)

        if (!digest?.content?.trim()) {
          logger.info(`[Ideation] Skipping ${account.id} — no digest available (topic required)`)
          results.push({ brandId: account.id, status: 'skipped', error: 'No digest available' })
          continue
        }

        const brand = await prisma.brand.findUnique({
          where: { id: account.brandId },
          select: { language: true, ideationCount: true, autoApproveIdeas: true },
        })

        const language = brand?.language ?? 'Spanish'
        const count = brand?.ideationCount ?? 9

        // Recent content for diversity tracking
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        const recentPosts = await prisma.post.findMany({
          where: { brandId: account.id, createdAt: { gte: fourteenDaysAgo }, caption: { not: null } },
          select: { caption: true },
          take: 30,
        })
        const recentContent = recentPosts.map((p) => p.caption!.slice(0, 100))

        const sourceRef =
          digest.attachedUrls.length > 0
            ? digest.attachedUrls.length === 1
              ? digest.attachedUrls[0]
              : JSON.stringify(digest.attachedUrls)
            : null

        const output = await generateContentIdeas({
          topic: digest.content,
          language,
          count,
          recentContent,
        })

        const autoApprove = brand?.autoApproveIdeas ?? false
        const batchId = crypto.randomUUID()
        for (const idea of output.ideas) {
          await prisma.post.create({
            data: {
              brandId: account.id,
              ideaText: idea.concept,
              status: autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING',
              source: 'automatic',
              priority: 3,
              sourceRef,
              generationBatchId: batchId,
              llmTrace: { ideaTrace: output.trace },
            },
          })
        }

        results.push({
          brandId: account.id,
          status: 'success',
          ideasGenerated: output.ideas.length,
          summary: output.briefSummary,
        })

        logger.info(
          `[Ideation] Generated ${output.ideas.length} ideas for ${account.username ?? account.id}`,
        )
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
