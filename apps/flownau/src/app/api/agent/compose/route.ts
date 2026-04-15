export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@prisma/client'
import { checkAccountAccess } from '@/modules/shared/actions'
import { z } from 'zod'
import { logError, logger } from '@/modules/shared/logger'
import { compose } from '@/modules/composer/scene-composer'
import { selectAssetsForCreative, commitAssetUsage } from '@/modules/composer/asset-curator'
import { compileTimeline } from '@/modules/composer/timeline-compiler'

const ComposeRequestSchema = z.object({
  prompt: z.string().min(3),
  accountId: z.string(),
  format: z.enum(['reel', 'trial_reel', 'carousel', 'single_image']).default('reel'),
  ideaId: z.string().optional(),
  personaId: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = ComposeRequestSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.format() },
        { status: 400 },
      )
    }

    const { prompt, accountId, format, ideaId, personaId } = parsed.data

    await checkAccountAccess(accountId)

    // 1. SceneComposer: AI Creative Direction
    const { creative } = await compose({
      ideaText: prompt,
      accountId,
      format,
      personaId,
    })

    // 2. AssetCurator: Select media + audio
    const { sceneAssets, audioAsset } = await selectAssetsForCreative(creative, accountId, 30)

    // 3. Build brand style
    const brandStyle = {
      primaryColor: '#6C63FF',
      accentColor: '#FF6584',
      fontFamily: 'sans-serif',
    }

    // 4. TimelineCompiler: Deterministic assembly
    const { schema } = compileTimeline(creative, sceneAssets, audioAsset, brandStyle, format)

    // 5. Determine approval state
    const persona = personaId
      ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
      : ((await prisma.brandPersona.findFirst({ where: { accountId, isDefault: true } })) ??
        (await prisma.brandPersona.findFirst({ where: { accountId } })))

    const isAutoApprove = persona?.autoApproveCompositions ?? false

    // 6. Save Composition
    const newComposition = await prisma.composition.create({
      data: {
        accountId,
        format,
        creative: creative as unknown as Prisma.InputJsonValue,
        payload: schema as unknown as Prisma.InputJsonValue,
        caption: creative.caption,
        hashtags: creative.hashtags,
        ideaId: ideaId ?? null,
        status: isAutoApprove ? 'APPROVED' : 'DRAFT',
      },
    })

    // 7. Consume idea if provided
    if (ideaId) {
      await prisma.contentIdea.update({
        where: { id: ideaId },
        data: { status: 'USED' },
      })
    }

    // 8. Track asset usage
    const usedAssetIds = [...sceneAssets.values()].map((a) => a.id)
    if (audioAsset) usedAssetIds.push(audioAsset.id)
    await commitAssetUsage(usedAssetIds)

    logger.info(
      `[DashboardCompose] Created composition ${newComposition.id} (${creative.scenes.length} scenes)`,
    )

    return NextResponse.json({ composition: newComposition }, { status: 200 })
  } catch (error: unknown) {
    logError('AGENT_COMPOSE_ROUTE_ERROR', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate composition', message }, { status: 500 })
  }
}
