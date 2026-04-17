import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@prisma/client'
import { compose } from '@/modules/composer/scene-composer'
import { selectAssetsForCreative, commitAssetUsage } from '@/modules/composer/asset-curator'
import { compileTimeline } from '@/modules/composer/timeline-compiler'
import { addRenderJob } from '@/modules/renderer/render-queue'
import { generateTopicHash } from '@/modules/planning/daily-plan.service'
import { logError, logger } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for AI generation timeout

/**
 * GET /api/cron/composer
 *
 * Processes APPROVED content ideas through the v2 scene-based composition pipeline:
 * 1. SceneComposer: AI generates CreativeDirection (scene sequence + text slots)
 * 2. AssetCurator: Selects matching media assets with duration/tag filtering
 * 3. TimelineCompiler: Deterministic frame math → validated DynamicCompositionSchema
 * 4. Save Composition with creative direction, compiled payload, and caption
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

    // 1. Find APPROVED content ideas (batch)
    const approvedIdeas = await prisma.contentIdea.findMany({
      where: { status: 'APPROVED' },
      include: { account: true },
      take: 20,
    })

    if (approvedIdeas.length === 0) {
      return NextResponse.json({ message: 'No approved ideas to process', results: [] })
    }

    logger.info(`[Composer] Processing ${approvedIdeas.length} approved ideas`)

    for (const idea of approvedIdeas) {
      if (!idea.account) continue

      // Resolve auto-approve setting
      const persona = await prisma.brandPersona.findFirst({
        where: { accountId: idea.accountId, isDefault: true },
      })

      try {
        // 2. SceneComposer: AI Creative Direction
        const { creative } = await compose({
          ideaText: idea.ideaText,
          accountId: idea.accountId,
          format: 'reel',
          personaId: persona?.id,
        })

        // 3. AssetCurator: Select media + audio
        const { sceneAssets, audioAsset } = await selectAssetsForCreative(
          creative,
          idea.accountId,
          30, // fps
        )

        // 4. Build brand style from persona
        const brandStyle = {
          primaryColor: '#6C63FF',
          accentColor: '#FF6584',
          fontFamily: 'sans-serif',
        }

        // 5. TimelineCompiler: Deterministic assembly
        const { schema } = compileTimeline(creative, sceneAssets, audioAsset, brandStyle, 'reel')

        // 6. Save Composition
        const isAutoApprove = persona?.autoApproveCompositions ?? false

        const sceneTypes = creative.scenes.map((s: { type: string }) => s.type)
        const topicHash = generateTopicHash(idea.ideaText)

        const composition = await prisma.composition.create({
          data: {
            accountId: idea.accountId,
            format: 'reel',
            creative: creative as unknown as Prisma.InputJsonValue,
            payload: schema as unknown as Prisma.InputJsonValue,
            caption: creative.caption,
            hashtags: creative.hashtags,
            ideaId: idea.id,
            sceneTypes,
            topicHash,
            status: isAutoApprove ? 'APPROVED' : 'DRAFT',
          },
        })

        // 7. Mark idea as USED
        await prisma.contentIdea.update({
          where: { id: idea.id },
          data: { status: 'USED' },
        })

        // 8. Commit asset usage tracking
        const usedAssetIds = [...sceneAssets.values()].map((a) => a.id)
        if (audioAsset) usedAssetIds.push(audioAsset.id)
        await commitAssetUsage(usedAssetIds)

        // 9. If auto-approved, enqueue for rendering
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
          `[Composer] Created composition ${composition.id} from idea ${idea.id} (${creative.scenes.length} scenes, ${isAutoApprove ? 'auto-approved' : 'draft'})`,
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
