export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@prisma/client'
import { checkAccountAccess } from '@/modules/shared/actions'
import { z } from 'zod'
import { logError, logger } from '@/modules/shared/logger'
import { checkRateLimit } from '@/modules/shared/rate-limit'
import { compose } from '@/modules/composer/scene-composer'
import { composeHeadTalk } from '@/modules/composer/head-talk-composer'
import { selectAssetsForCreative, commitAssetUsage } from '@/modules/composer/asset-curator'
import { compileTimeline } from '@/modules/composer/timeline-compiler'

const ComposeRequestSchema = z.object({
  prompt: z.string().min(3),
  accountId: z.string(),
  format: z
    .enum(['reel', 'trial_reel', 'head_talk', 'carousel', 'static_post', 'story'])
    .default('reel'),
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

    // Rate limit: 10 compose requests per minute per account
    const rateLimit = await checkRateLimit({
      key: `rate:compose:${accountId}`,
      maxRequests: 10,
      windowSeconds: 60,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 10 compose requests per minute.' },
        {
          status: 429,
          headers: { 'X-RateLimit-Reset': String(rateLimit.resetAt) },
        },
      )
    }

    await checkAccountAccess(accountId)

    // Fetch persona for auto-approve flags
    const persona = personaId
      ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
      : ((await prisma.brandPersona.findFirst({ where: { accountId, isDefault: true } })) ??
        (await prisma.brandPersona.findFirst({ where: { accountId } })))

    const isAutoApproveCompositions = persona?.autoApproveCompositions ?? false
    const isAutoApprovePool = (persona as any)?.engine_autoApprovePool ?? false

    const finalStatus = isAutoApproveCompositions || isAutoApprovePool ? 'APPROVED' : 'DRAFT'

    let newComposition

    if (format === 'head_talk') {
      // Head Talk: AI generates script + caption + hashtags only. No video/image assets.
      const result = await composeHeadTalk({ ideaText: prompt, accountId, personaId })

      newComposition = await prisma.composition.create({
        data: {
          accountId,
          format,
          source: 'composed',
          payload: { type: 'head_talk', script: result.script } as unknown as Prisma.InputJsonValue,
          caption: result.caption,
          hashtags: result.hashtags,
          ideaId: ideaId ?? null,
          status: finalStatus,
        },
      })

      logger.info(`[HeadTalkCompose] Created script composition ${newComposition.id}`)
    } else {
      // Standard scene-based compose pipeline
      const { creative } = await compose({ ideaText: prompt, accountId, format, personaId })

      const { sceneAssets, audioAsset } = await selectAssetsForCreative(creative, accountId, 30)

      const brandStyle = {
        primaryColor: '#6C63FF',
        accentColor: '#FF6584',
        fontFamily: 'sans-serif',
      }

      const { schema } = compileTimeline(creative, sceneAssets, audioAsset, brandStyle, format)

      newComposition = await prisma.composition.create({
        data: {
          accountId,
          format,
          source: 'composed',
          creative: creative as unknown as Prisma.InputJsonValue,
          payload: schema as unknown as Prisma.InputJsonValue,
          caption: creative.caption,
          hashtags: creative.hashtags,
          ideaId: ideaId ?? null,
          status: finalStatus,
        },
      })

      // Track asset usage
      const usedAssetIds = [...sceneAssets.values()].map((a) => a.id)
      if (audioAsset) usedAssetIds.push(audioAsset.id)
      await commitAssetUsage(usedAssetIds)

      logger.info(
        `[DashboardCompose] Created composition ${newComposition.id} (${creative.scenes.length} scenes)`,
      )
    }

    // Mark idea as USED after successful compose
    if (ideaId) {
      await prisma.contentIdea.update({
        where: { id: ideaId },
        data: { status: 'USED' },
      })
    }

    return NextResponse.json({ composition: newComposition }, { status: 200 })
  } catch (error: unknown) {
    logError('AGENT_COMPOSE_ROUTE_ERROR', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate composition', message }, { status: 500 })
  }
}
