export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { prisma } from '@/modules/shared/prisma'
import { compose } from '@/modules/composer/scene-composer'
import { selectAssetsForCreative, commitAssetUsage } from '@/modules/composer/asset-curator'
import { compileTimeline } from '@/modules/composer/timeline-compiler'
import { addRenderJob } from '@/modules/renderer/render-queue'
import { logError, logger } from '@/modules/shared/logger'
import { generateTopicHash } from '@/modules/planning/daily-plan.service'
import type { Prisma } from '@prisma/client'
import type { ContentFormat } from '@/types/content'

const ComposeRequestSchema = z.object({
  brandId: z.string().min(1),
  prompt: z.string().min(1),
  format: z.enum(['reel', 'trial_reel', 'carousel', 'static_post']).default('reel'),
  source: z.string().optional(),
  sourceRef: z.string().optional(),
  autoApprove: z.boolean().default(false),
})

/**
 * POST /api/v1/compose — Trigger reactive content composition.
 * Called by: 9naŭ API, Zazŭ, echonau
 * Auth: NAU_SERVICE_KEY
 *
 * Creates an idea and optionally runs the full composition pipeline immediately.
 */
export async function POST(req: Request) {
  if (!(await validateServiceToken(req))) {
    return unauthorizedResponse()
  }

  try {
    const body: unknown = await req.json()
    const input = ComposeRequestSchema.parse(body)

    // 1. Verify account exists
    const account = await prisma.socialProfile.findUnique({
      where: { id: input.brandId },
    })

    if (!account) {
      return NextResponse.json({ error: `Account ${input.brandId} not found` }, { status: 404 })
    }

    // 2. Create Post at idea stage
    const post = await prisma.post.create({
      data: {
        brandId: input.brandId,
        ideaText: input.prompt,
        source: input.source ?? 'reactive',
        sourceRef: input.sourceRef ?? null,
        status: input.autoApprove ? 'IDEA_APPROVED' : 'IDEA_PENDING',
        priority: 2,
      },
    })

    if (!input.autoApprove) {
      return NextResponse.json({ postId: post.id, status: 'pending_approval' })
    }

    // Auto-approve: run the full composition pipeline
    const persona = await prisma.brandPersona.findFirst({
      where: { brandId: input.brandId, isDefault: true },
    })

    const { creative } = await compose({
      ideaText: input.prompt,
      brandId: input.brandId,
      format: input.format as ContentFormat,
      personaId: persona?.id,
    })

    const { sceneAssets, audioAsset } = await selectAssetsForCreative(creative, input.brandId, 30)

    const brandStyle = { primaryColor: '#6C63FF', accentColor: '#FF6584', fontFamily: 'sans-serif' }
    const { schema } = compileTimeline(creative, sceneAssets, audioAsset, brandStyle, input.format)

    const sceneTypes = creative.scenes.map((s: { type: string }) => s.type)
    const topicHash = generateTopicHash(input.prompt)

    const updatedPost = await prisma.post.update({
      where: { id: post.id },
      data: {
        format: input.format,
        creative: creative as unknown as Prisma.InputJsonValue,
        payload: schema as unknown as Prisma.InputJsonValue,
        caption: creative.caption,
        hashtags: creative.hashtags,
        sceneTypes,
        topicHash,
        status: 'RENDERING',
        brandPersonaId: persona?.id ?? null,
      },
    })

    const usedAssetIds = [...sceneAssets.values()].map((a) => a.id)
    if (audioAsset) usedAssetIds.push(audioAsset.id)
    await commitAssetUsage(usedAssetIds)

    await prisma.renderJob.create({
      data: {
        postId: updatedPost.id,
        status: 'queued',
        outputType: input.format === 'carousel' || input.format === 'static_post' ? 'image' : 'video',
      },
    })
    await addRenderJob(updatedPost.id)

    logger.info(`[ComposeAPI] Reactive post ${updatedPost.id} created and enqueued (${creative.scenes.length} scenes)`)

    return NextResponse.json({ postId: updatedPost.id, status: 'rendering' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[ComposeAPI] Failed', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
