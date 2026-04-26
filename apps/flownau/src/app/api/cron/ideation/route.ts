import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { fetchBrandDigest } from '@/modules/ideation/sources/inspo-source'
import { getBrandDNA } from '@/modules/ideation/sources/brand-dna-source'
import { resolveProvenance } from '@/modules/ideation/provenance'
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
      headTalkDetected?: number
      summary?: string
      error?: string
    }> = []

    const accounts = await prisma.socialProfile.findMany({
      take: 10,
    })

    for (const account of accounts) {
      // Phase 18: resolve provenance (persona + framework + principles) once per account
      const provenance = await resolveProvenance(account.id)
      if (!provenance.brandPersonaId) continue

      const persona = await prisma.brandPersona.findUnique({
        where: { id: provenance.brandPersonaId },
      })
      if (!persona) continue

      // Skip if there are any pending ideas — only generate when the pipeline is exhausted
      const pendingIdeasCount = await prisma.contentIdea.count({
        where: { brandId: account.id, status: 'PENDING' },
      })

      if (pendingIdeasCount > 0) continue

      try {
        // 1. Fetch mechanical InspoBase Digest from nauthenticity (graceful degradation)
        const digest = await fetchBrandDigest(account.id)

        // 2. Get Brand DNA
        const brandDNA = await getBrandDNA(account.id)

        // 3. Get recent content for diversity tracking
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        const recentCompositions = await prisma.composition.findMany({
          where: {
            brandId: account.id,
            createdAt: { gte: fourteenDaysAgo },
          },
          select: { caption: true, sceneTypes: true },
          take: 30,
        })

        const recentPosts = recentCompositions
          .filter((c) => c.caption)
          .map((c) => c.caption!.slice(0, 100))

        // 4. Per-origin settings
        const automaticCount = persona.automaticCount ?? 5
        const automaticAutoApprove = persona.automaticAutoApprove ?? persona.autoApproveIdeas

        // 5. Generate ideas — Phase 18: includes framework as "strategy"
        const output = await generateContentIdeas({
          brandName: persona.name,
          dna: brandDNA,
          strategy: provenance.frameworkSystemPrompt ?? undefined,
          count: automaticCount,
          digest: digest ?? undefined,
          recentContent: recentPosts,
        })

        // 6. Insert ideas with head-talk detection and lineage tracking
        let headTalkCount = 0

        // Lineage: store the primary attached URL (or JSON array) as sourceRef so the
        // user can trace which original posts inspired this batch of generated ideas.
        const digestSourceRef =
          digest && digest.attachedUrls.length > 0
            ? digest.attachedUrls.length === 1
              ? digest.attachedUrls[0]
              : JSON.stringify(digest.attachedUrls)
            : null

        for (const idea of output.ideas) {
          const ideaText = `[${idea.format.toUpperCase()}] Hook: ${idea.hook}\nAngle: ${idea.angle}\nScript: ${idea.script}\nCTA: ${idea.cta}`

          const isHeadTalk = detectHeadTalk(ideaText)
          if (isHeadTalk) headTalkCount++

          await prisma.contentIdea.create({
            data: {
              brandId: account.id,
              ideaText,
              format: idea.format,
              status: isHeadTalk
                ? 'PENDING' // Head-talk ideas always require manual approval
                : automaticAutoApprove
                  ? 'APPROVED'
                  : 'PENDING',
              source: 'automatic',
              priority: 3,
              sourceRef: digestSourceRef,
              brandPersonaId: provenance.brandPersonaId,
              ideasFrameworkId: provenance.ideasFrameworkId,
              contentPrinciplesId: provenance.contentPrinciplesId,
            },
          })
        }

        results.push({
          brandId: account.id,
          status: 'success',
          ideasGenerated: output.ideas.length,
          headTalkDetected: headTalkCount,
          summary: output.briefSummary,
        })

        logger.info(
          `[Ideation] Generated ${output.ideas.length} ideas for ${account.username ?? account.id} (${headTalkCount} head-talk, digest: ${digest ? 'yes' : 'none'})`,
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
