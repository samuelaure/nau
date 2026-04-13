import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { fetchInspoItems } from '@/modules/ideation/sources/inspo-source'
import { getBrandDNA } from '@/modules/ideation/sources/brand-dna-source'
import { detectHeadTalk } from '@/modules/planning/daily-plan.service'
import { logError, logger } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for AI generation timeout

/**
 * GET /api/cron/ideation
 *
 * Generates content ideas for each active account using:
 * 1. InspoItems from nauthenticity (graceful degradation)
 * 2. Brand DNA as fallback
 * 3. Recent content history for diversity
 * 4. Head-talk detection for face-to-camera ideas
 */
export async function GET() {
  try {
    const results: Array<{
      accountId: string
      status: string
      ideasGenerated?: number
      headTalkDetected?: number
      summary?: string
      error?: string
    }> = []

    const accounts = await prisma.socialAccount.findMany({
      take: 10,
    })

    for (const account of accounts) {
      const persona = await prisma.brandPersona.findFirst({
        where: { accountId: account.id, isDefault: true },
      })

      if (!persona) continue

      // Skip if already have plenty of pending ideas
      const pendingIdeasCount = await prisma.contentIdea.count({
        where: { accountId: account.id, status: 'PENDING' },
      })

      if (pendingIdeasCount >= 10) continue

      try {
        // 1. Fetch InspoItems from nauthenticity (graceful degradation)
        const inspoItems = await fetchInspoItems(account.id)

        // 2. Get Brand DNA
        const brandDNA = await getBrandDNA(account.id)

        // 3. Get recent content for diversity tracking
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        const recentCompositions = await prisma.composition.findMany({
          where: {
            accountId: account.id,
            createdAt: { gte: fourteenDaysAgo },
          },
          select: { caption: true, sceneTypes: true },
          take: 30,
        })

        const recentPosts = recentCompositions
          .filter((c) => c.caption)
          .map((c) => c.caption!.slice(0, 100))

        // 4. Generate ideas
        const output = await generateContentIdeas({
          brandName: persona.name,
          brandDNA,
          inspoItems,
          recentPosts,
        })

        // 5. Insert ideas with head-talk detection
        let headTalkCount = 0

        for (const idea of output.ideas) {
          const ideaText = `[${idea.format.toUpperCase()}] Hook: ${idea.hook}\nAngle: ${idea.angle}\nScript: ${idea.script}\nCTA: ${idea.cta}`

          const isHeadTalk = detectHeadTalk(ideaText)
          if (isHeadTalk) headTalkCount++

          await prisma.contentIdea.create({
            data: {
              accountId: account.id,
              ideaText,
              status: isHeadTalk
                ? 'PENDING' // Head-talk ideas always require manual approval
                : persona.autoApproveIdeas
                  ? 'APPROVED'
                  : 'PENDING',
              source: inspoItems.length > 0 ? 'inspo' : 'internal',
              sourceRef: idea.inspoItemId ?? null,
            },
          })
        }

        results.push({
          accountId: account.id,
          status: 'success',
          ideasGenerated: output.ideas.length,
          headTalkDetected: headTalkCount,
          summary: output.briefSummary,
        })

        logger.info(
          `[Ideation] Generated ${output.ideas.length} ideas for ${account.username ?? account.id} (${headTalkCount} head-talk, ${inspoItems.length} inspo items used)`,
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logError(`[Ideation] Failed for account ${account.id}`, err)
        results.push({ accountId: account.id, status: 'failed', error: msg })
      }
    }

    return NextResponse.json({ message: 'Ideation Execution Finished', results })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Ideation] Fatal error', error)
    return NextResponse.json({ error: 'Fatal ideation failure', details: msg }, { status: 500 })
  }
}
