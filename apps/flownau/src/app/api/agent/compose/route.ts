export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@prisma/client'
import { checkBrandAccess } from '@/modules/shared/actions'
import { z } from 'zod'
import { logError, logger } from '@/modules/shared/logger'
import { checkRateLimit } from '@/modules/shared/rate-limit'
import { compose } from '@/modules/composer/scene-composer'
import { composeHeadTalk } from '@/modules/composer/head-talk-composer'
import { selectAssetsForCreative, commitAssetUsage } from '@/modules/composer/asset-curator'
import { compileTimeline } from '@/modules/composer/timeline-compiler'

const ComposeRequestSchema = z.object({
  prompt: z.string().min(3),
  brandId: z.string(),
  format: z
    .enum(['reel', 'trial_reel', 'head_talk', 'carousel', 'static_post', 'story'])
    .default('reel'),
  postId: z.string().optional(),
  personaId: z.string().optional(),
  templateId: z.string().optional(),
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

    const { prompt, brandId, format, postId, personaId, templateId } = parsed.data

    // Rate limit: 10 compose requests per minute per account
    const rateLimit = await checkRateLimit({
      key: `rate:compose:${brandId}`,
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

    await checkBrandAccess(brandId)

    // Resolve templateId: explicit > from existing post > none
    const resolvedTemplateId =
      templateId ??
      (postId
        ? (await prisma.post.findUnique({ where: { id: postId }, select: { templateId: true } }))
            ?.templateId ?? undefined
        : undefined)

    // Fetch persona for auto-approve flags
    const persona = personaId
      ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
      : ((await prisma.brandPersona.findFirst({ where: { brandId, isDefault: true } })) ??
        (await prisma.brandPersona.findFirst({ where: { brandId } })))

    // Check template auto-approve
    let autoApproveDraft = persona?.autoApproveCompositions ?? false
    if (!autoApproveDraft && resolvedTemplateId) {
      const config = await prisma.brandTemplateConfig.findUnique({
        where: { brandId_templateId: { brandId, templateId: resolvedTemplateId } },
        select: { autoApproveDraft: true },
      })
      autoApproveDraft = config?.autoApproveDraft ?? false
    }

    const draftStatus = autoApproveDraft ? 'DRAFT_APPROVED' : 'DRAFT_PENDING'

    let updatedPost

    if (format === 'head_talk') {
      const result = await composeHeadTalk({
        ideaText: prompt,
        brandId,
        personaId,
        templateId: resolvedTemplateId,
      })

      if (postId) {
        updatedPost = await prisma.post.update({
          where: { id: postId },
          data: {
            format,
            creative: result.creative as unknown as Prisma.InputJsonValue,
            caption: result.caption,
            hashtags: result.hashtags,
            status: draftStatus,
            templateId: result.templateId ?? resolvedTemplateId ?? null,
            brandPersonaId: result.personaId ?? persona?.id ?? null,
          },
        })
      } else {
        updatedPost = await prisma.post.create({
          data: {
            brandId,
            ideaText: prompt,
            format,
            creative: result.creative as unknown as Prisma.InputJsonValue,
            caption: result.caption,
            hashtags: result.hashtags,
            status: draftStatus,
            source: 'manual',
            templateId: result.templateId ?? resolvedTemplateId ?? null,
            brandPersonaId: result.personaId ?? persona?.id ?? null,
          },
        })
      }

      logger.info(`[HeadTalkCompose] Updated post ${updatedPost.id}`)
    } else {
      const { creative } = await compose({ ideaText: prompt, brandId, format, personaId })

      const { sceneAssets, audioAsset } = await selectAssetsForCreative(creative, brandId, 30)

      const brandStyle = {
        primaryColor: '#6C63FF',
        accentColor: '#FF6584',
        fontFamily: 'sans-serif',
      }

      const { schema } = compileTimeline(creative, sceneAssets, audioAsset, brandStyle, format)

      if (postId) {
        updatedPost = await prisma.post.update({
          where: { id: postId },
          data: {
            format,
            creative: creative as unknown as Prisma.InputJsonValue,
            payload: schema as unknown as Prisma.InputJsonValue,
            caption: creative.caption,
            hashtags: creative.hashtags,
            status: draftStatus,
            brandPersonaId: persona?.id ?? null,
          },
        })
      } else {
        updatedPost = await prisma.post.create({
          data: {
            brandId,
            ideaText: prompt,
            format,
            creative: creative as unknown as Prisma.InputJsonValue,
            payload: schema as unknown as Prisma.InputJsonValue,
            caption: creative.caption,
            hashtags: creative.hashtags,
            status: draftStatus,
            source: 'manual',
            brandPersonaId: persona?.id ?? null,
          },
        })
      }

      // Track asset usage
      const usedAssetIds = [...sceneAssets.values()].map((a) => a.id)
      if (audioAsset) usedAssetIds.push(audioAsset.id)
      await commitAssetUsage(usedAssetIds)

      logger.info(
        `[DashboardCompose] Updated post ${updatedPost.id} (${creative.scenes.length} scenes)`,
      )
    }

    return NextResponse.json({ post: updatedPost }, { status: 200 })
  } catch (error: unknown) {
    logError('AGENT_COMPOSE_ROUTE_ERROR', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate composition', message }, { status: 500 })
  }
}
