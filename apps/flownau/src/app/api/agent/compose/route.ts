export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@/generated/prisma'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { z } from 'zod'
import { logError, logger } from '@/modules/shared/logger'
import { checkRateLimit } from '@/modules/shared/rate-limit'
import { composeHeadTalk } from '@/modules/composer/headtalk-composer'
import { composeReel } from '@/modules/composer/reel-composer'

const ComposeRequestSchema = z.object({
  prompt: z.string().min(3),
  brandId: z.string(),
  format: z
    .enum(['reel', 'trial_reel', 'head_talk', 'carousel', 'static_post', 'story'])
    .default('reel'),
  postId: z.string().optional(),
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

    const { prompt, brandId, format: requestedFormat, postId, templateId } = parsed.data

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

    const denied = await checkBrandAccessForRoute(brandId)
    if (denied) return denied

    // ── Slot-aware format + template resolution ───────────────────────────────
    // If templateId is given: format = template's format, find next slot of that format.
    // If no templateId: find next empty slot (any format), derive format from slot,
    //   then pick a random enabled template for that format.
    // If no slot found for chosen format: post remains unscheduled (ok).

    let format = requestedFormat
    let targetSlotId: string | null = null
    let targetSlotScheduledAt: Date | null = null

    // When recomposing an existing post (postId provided), never reassign slots —
    // the post already owns its slot and we just want to regenerate creative.
    if (!postId) {
      // Get template's format if templateId is explicit
      const templateFormat = templateId
        ? (await prisma.template.findUnique({ where: { id: templateId }, select: { format: true } }))?.format ?? null
        : null

      if (templateId && templateFormat) {
        // Find next empty slot of the template's format
        const slot = await prisma.postSlot.findFirst({
          where: { brandId, status: 'empty', format: templateFormat, scheduledAt: { gt: new Date() } },
          orderBy: { scheduledAt: 'asc' },
        })
        if (slot) { targetSlotId = slot.id; targetSlotScheduledAt = slot.scheduledAt; format = templateFormat as typeof format }
      } else if (!templateId) {
        // Auto mode: find next empty slot of any format
        const slot = await prisma.postSlot.findFirst({
          where: { brandId, status: 'empty', scheduledAt: { gt: new Date() } },
          orderBy: { scheduledAt: 'asc' },
        })
        if (slot) {
          targetSlotId = slot.id
          targetSlotScheduledAt = slot.scheduledAt
          format = slot.format as typeof format
        }
      }
    }

    // Resolve templateId: explicit > auto-pick for format (with or without slot) > from existing post > none
    let resolvedTemplateId: string | undefined = templateId
    if (!resolvedTemplateId && format) {
      const key = format === 'trial_reel' ? 'reel' : format
      const configs = await prisma.brandTemplateConfig.findMany({
        where: { brandId, enabled: true, template: { format: key } },
        select: { template: { select: { id: true } } },
      })
      if (configs.length > 0) {
        resolvedTemplateId = configs[Math.floor(Math.random() * configs.length)]!.template.id
      }
    }
    if (!resolvedTemplateId && postId) {
      resolvedTemplateId =
        (await prisma.post.findUnique({ where: { id: postId }, select: { templateId: true } }))
          ?.templateId ?? undefined
    }

    // Check template config for auto-approve draft
    let autoApproveDraft = false
    if (resolvedTemplateId) {
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
        templateId: resolvedTemplateId,
      })

      if (postId) {
        const existing = await prisma.post.findUnique({ where: { id: postId }, select: { llmTrace: true } })
        updatedPost = await prisma.post.update({
          where: { id: postId },
          data: {
            format,
            creative: result.creative as unknown as unknown as Prisma.InputJsonValue,
            caption: result.caption,
            hashtags: result.hashtags,
            status: draftStatus,
            templateId: result.templateId ?? resolvedTemplateId ?? null,
            llmTrace: { ...(existing?.llmTrace as object ?? {}), draftTrace: result.trace } as unknown as Prisma.InputJsonValue,
          },
        })
      } else {
        updatedPost = await prisma.post.create({
          data: {
            brandId,
            ideaText: prompt,
            format,
            creative: result.creative as unknown as unknown as Prisma.InputJsonValue,
            caption: result.caption,
            hashtags: result.hashtags,
            status: draftStatus,
            source: 'manual',
            templateId: result.templateId ?? resolvedTemplateId ?? null,
            llmTrace: { draftTrace: result.trace } as unknown as Prisma.InputJsonValue,
          },
        })
      }

      logger.info(`[HeadTalkCompose] Updated post ${updatedPost.id}`)
    } else {
      const templateMeta = resolvedTemplateId
        ? await prisma.template.findUnique({ where: { id: resolvedTemplateId }, select: { remotionId: true } })
        : null

      if (!resolvedTemplateId) {
        return NextResponse.json({ error: 'No template found for this format' }, { status: 400 })
      }

      const result = await composeReel({
        ideaText: prompt,
        brandId,
        templateId: resolvedTemplateId,
      })

      const creativeData = {
        slots: result.slots,
        caption: result.caption,
        hashtags: result.hashtags,
        brollMood: result.brollMood,
      }

      if (postId) {
        const existing = await prisma.post.findUnique({ where: { id: postId }, select: { llmTrace: true } })
        updatedPost = await prisma.post.update({
          where: { id: postId },
          data: {
            format,
            creative: creativeData as unknown as unknown as Prisma.InputJsonValue,
            caption: result.caption,
            hashtags: result.hashtags,
            status: draftStatus,
            templateId: resolvedTemplateId,
            llmTrace: { ...(existing?.llmTrace as object ?? {}), draftTrace: result.trace } as unknown as Prisma.InputJsonValue,
          },
        })
      } else {
        updatedPost = await prisma.post.create({
          data: {
            brandId,
            ideaText: prompt,
            format,
            creative: creativeData as unknown as unknown as Prisma.InputJsonValue,
            caption: result.caption,
            hashtags: result.hashtags,
            status: draftStatus,
            source: 'manual',
            templateId: resolvedTemplateId,
            llmTrace: { draftTrace: result.trace } as unknown as Prisma.InputJsonValue,
          },
        })
      }

      logger.info(`[SlotCompose] Created post ${updatedPost.id} (${templateMeta?.remotionId})`)
    }

    // Assign to slot if one was resolved
    if (targetSlotId && targetSlotScheduledAt && updatedPost) {
      await prisma.post.update({
        where: { id: updatedPost.id },
        data: { scheduledAt: targetSlotScheduledAt },
      })
      await prisma.postSlot.update({
        where: { id: targetSlotId },
        data: { status: 'filled', postId: updatedPost.id },
      })
      updatedPost = { ...updatedPost, scheduledAt: targetSlotScheduledAt }
      logger.info({ postId: updatedPost.id, slotId: targetSlotId }, '[COMPOSE] Post assigned to slot')
    }

    return NextResponse.json({ post: updatedPost }, { status: 200 })
  } catch (error: unknown) {
    logError('AGENT_COMPOSE_ROUTE_ERROR', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate composition', message }, { status: 500 })
  }
}
