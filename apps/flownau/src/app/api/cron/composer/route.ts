import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@prisma/client'
import { compose } from '@/modules/composer/scene-composer'
import { selectAssetsForCreative, commitAssetUsage } from '@/modules/composer/asset-curator'
import { compileTimeline } from '@/modules/composer/timeline-compiler'
import { addRenderJob } from '@/modules/renderer/render-queue'
import { selectTemplateForIdea } from '@/modules/composer/template-selector'
import { generateTopicHash } from '@/modules/planning/daily-plan.service'
import { logError, logger } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'
import type { ContentFormat } from '@/types/content'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for AI generation timeout

// Formats that are user-managed (head_talk / replicate) — composer still creates the
// placeholder Composition (with provenance) but does NOT run AI scene-composition.
const USER_MANAGED_FORMATS: ReadonlySet<string> = new Set(['head_talk', 'replicate'])

/**
 * GET /api/cron/composer
 *
 * Phase 18: Processes APPROVED content ideas into Compositions.
 * - Pulls persona/framework/principles FKs from the idea (provenance carried forward).
 * - Selects a matching Template based on idea.format + AccountTemplateConfig.enabled.
 * - Builds AI prompt from persona + framework + principles + template.contentSchema.
 * - Skips AI/asset-curation for user-managed formats (head_talk, replicate).
 */
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const results: Array<{
      ideaId: string
      accountId: string
      status: string
      compositionId?: string
      error?: string
    }> = []

    const approvedIdeas = await prisma.contentIdea.findMany({
      where: { status: 'APPROVED' },
      include: {
        account: true,
        brandPersona: true,
        ideasFramework: true,
        contentPrinciples: true,
      },
      take: 20,
    })

    if (approvedIdeas.length === 0) {
      return NextResponse.json({ message: 'No approved ideas to process', results: [] })
    }

    logger.info(`[Composer] Processing ${approvedIdeas.length} approved ideas`)

    for (const idea of approvedIdeas) {
      if (!idea.account) continue

      const format: ContentFormat = (idea.format as ContentFormat) || 'reel'
      const persona = idea.brandPersona
      const framework = idea.ideasFramework
      const principles = idea.contentPrinciples

      try {
        // Template selection: account-scoped + format-matching + enabled AccountTemplateConfig.
        const selectedTemplate = await selectTemplateForIdea({
          accountId: idea.accountId,
          format,
        })

        const isAutoApprove = persona?.autoApprovePool ?? false
        const topicHash = generateTopicHash(idea.ideaText)

        // User-managed formats bypass scene composition — they need media from the user.
        if (USER_MANAGED_FORMATS.has(format)) {
          const composition = await prisma.composition.create({
            data: {
              accountId: idea.accountId,
              format,
              source: 'composed',
              payload: {} as unknown as Prisma.InputJsonValue,
              caption: idea.ideaText.slice(0, 2000),
              ideaId: idea.id,
              templateId: selectedTemplate?.id ?? null,
              topicHash,
              status: isAutoApprove ? 'APPROVED' : 'DRAFT',
              brandPersonaId: persona?.id ?? null,
              ideasFrameworkId: framework?.id ?? null,
              contentPrinciplesId: principles?.id ?? null,
            },
          })
          await prisma.contentIdea.update({ where: { id: idea.id }, data: { status: 'USED' } })
          results.push({
            ideaId: idea.id,
            accountId: idea.accountId,
            status: 'success',
            compositionId: composition.id,
          })
          logger.info(
            `[Composer] Created user-managed ${format} composition ${composition.id} from idea ${idea.id}`,
          )
          continue
        }

        // 1. SceneComposer — AI Creative Direction with full provenance
        const { creative } = await compose({
          ideaText: idea.ideaText,
          accountId: idea.accountId,
          format,
          personaId: persona?.id,
          frameworkPrompt: framework?.systemPrompt ?? null,
          principlesPrompt: principles?.systemPrompt ?? null,
          templateContentSchema: selectedTemplate?.contentSchema ?? null,
          templateSystemPrompt: selectedTemplate?.systemPrompt ?? null,
        })

        // 2. Asset selection + timeline compile
        const { sceneAssets, audioAsset } = await selectAssetsForCreative(
          creative,
          idea.accountId,
          30,
        )
        const brandStyle = {
          primaryColor: '#6C63FF',
          accentColor: '#FF6584',
          fontFamily: 'sans-serif',
        }
        const { schema } = compileTimeline(creative, sceneAssets, audioAsset, brandStyle, format)

        // 3. Persist Composition with full provenance + template
        const sceneTypes = creative.scenes.map((s: { type: string }) => s.type)
        const composition = await prisma.composition.create({
          data: {
            accountId: idea.accountId,
            format,
            creative: creative as unknown as Prisma.InputJsonValue,
            payload: schema as unknown as Prisma.InputJsonValue,
            caption: creative.caption,
            hashtags: creative.hashtags,
            ideaId: idea.id,
            templateId: selectedTemplate?.id ?? null,
            sceneTypes,
            topicHash,
            status: isAutoApprove ? 'APPROVED' : 'DRAFT',
            brandPersonaId: persona?.id ?? null,
            ideasFrameworkId: framework?.id ?? null,
            contentPrinciplesId: principles?.id ?? null,
          },
        })

        // 4. Mark idea USED & commit asset usage
        await prisma.contentIdea.update({ where: { id: idea.id }, data: { status: 'USED' } })

        const usedAssetIds = [...sceneAssets.values()].map((a) => a.id)
        if (audioAsset) usedAssetIds.push(audioAsset.id)
        await commitAssetUsage(usedAssetIds)

        // 5. If auto-approved, enqueue for rendering
        if (isAutoApprove) {
          await prisma.renderJob.create({
            data: {
              compositionId: composition.id,
              status: 'queued',
              outputType: 'video',
            },
          })
          await addRenderJob(composition.id)
          await prisma.composition.update({
            where: { id: composition.id },
            data: { status: 'rendering' },
          })
        }

        results.push({
          ideaId: idea.id,
          accountId: idea.accountId,
          status: 'success',
          compositionId: composition.id,
        })

        logger.info(
          `[Composer] Created composition ${composition.id} from idea ${idea.id} (${creative.scenes.length} scenes, template=${selectedTemplate?.id ?? 'none'}, ${isAutoApprove ? 'auto-approved' : 'draft'})`,
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logError(`[Composer] Failed to compose idea ${idea.id}`, err)
        results.push({
          ideaId: idea.id,
          accountId: idea.accountId,
          status: 'failed',
          error: msg,
        })
      }
    }

    return NextResponse.json({
      message: 'Composer Execution Finished',
      processed: results.length,
      succeeded: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Composer] Fatal error', error)
    return NextResponse.json({ error: 'Fatal composer failure', details: msg }, { status: 500 })
  }
}
