export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { prisma } from '@/modules/shared/prisma'
import { composeSlots } from '@/modules/composer/slot-composer'
import { triggerRenderForPost } from '@/modules/renderer/render-queue'
import { selectTemplateForIdea } from '@/modules/composer/template-selector'
import { logError, logger } from '@/modules/shared/logger'
import type { Prisma } from '@prisma/client'

const ComposeRequestSchema = z.object({
  brandId: z.string().min(1),
  prompt: z.string().min(1),
  format: z.enum(['reel', 'trial_reel']).default('reel'),
  source: z.string().optional(),
  sourceRef: z.string().optional(),
  autoApprove: z.boolean().default(false),
})

/**
 * POST /api/v1/compose — Trigger reactive content composition.
 * Called by: 9naŭ API, Zazŭ, echonau
 * Auth: NAU_SERVICE_KEY
 */
export async function POST(req: Request) {
  if (!(await validateServiceToken(req))) {
    return unauthorizedResponse()
  }

  try {
    const body: unknown = await req.json()
    const input = ComposeRequestSchema.parse(body)

    const brand = await prisma.brand.findUnique({ where: { id: input.brandId } })
    if (!brand) {
      return NextResponse.json({ error: `Brand ${input.brandId} not found` }, { status: 404 })
    }

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

    const selectedTemplate = await selectTemplateForIdea({ brandId: input.brandId, format: input.format })
    if (!selectedTemplate) {
      return NextResponse.json({ error: 'No enabled template found for this format' }, { status: 400 })
    }

    const templateConfig = await prisma.brandTemplateConfig.findFirst({
      where: { brandId: input.brandId, templateId: selectedTemplate.id },
      select: { customPrompt: true },
    })

    const persona = await prisma.brandPersona.findFirst({ where: { brandId: input.brandId, isDefault: true } })

    const slotResult = await composeSlots({
      ideaText: input.prompt,
      brandId: input.brandId,
      templateId: selectedTemplate.id,
      personaId: persona?.id,
      customPrompt: templateConfig?.customPrompt ?? null,
    })

    const creative = { slots: slotResult.slots, caption: slotResult.caption, hashtags: slotResult.hashtags, brollMood: slotResult.brollMood }

    const updatedPost = await prisma.post.update({
      where: { id: post.id },
      data: {
        format: input.format,
        creative: creative as Prisma.InputJsonValue,
        caption: slotResult.caption,
        hashtags: slotResult.hashtags,
        templateId: selectedTemplate.id,
        status: 'DRAFT_APPROVED',
        brandPersonaId: persona?.id ?? null,
        llmTrace: { draftTrace: slotResult.trace },
      },
    })

    await triggerRenderForPost(updatedPost.id)

    logger.info(`[ComposeAPI] Reactive post ${updatedPost.id} created and enqueued`)

    return NextResponse.json({ postId: updatedPost.id, status: 'rendering' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[ComposeAPI] Failed', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
