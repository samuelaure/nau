export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { z } from 'zod'
import { logError, logger } from '@/modules/shared/logger'
import type { SceneDef } from '@/types/template-scenes'
import type { Prisma } from '@/generated/prisma'

// POST /api/templates/[id]/create-manual
// Creates a Post directly from manually entered content — no LLM call.
// Supports DynamicReel (scenes), legacy slot-based, and HeadTalk templates.

const SlotSchema = z.object({
  /** "scene_N_text_M" for DynamicReel, slot key for legacy, "script" for HeadTalk */
  key: z.string(),
  content: z.string(),
})

const BodySchema = z.object({
  brandId: z.string(),
  slots: z.array(SlotSchema),
  caption: z.string(),
  hashtags: z.array(z.string()).optional().default([]),
})

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await props.params
    const templateId = resolvedParams.id
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.format() },
        { status: 400 },
      )
    }

    const { brandId, slots, caption, hashtags } = parsed.data

    const denied = await checkBrandAccessForRoute(brandId)
    if (denied) return denied

    const [templateRaw, brandTemplateConfig] = await Promise.all([
      prisma.template.findUnique({ where: { id: templateId } }),
      prisma.brandTemplateConfig.findUnique({
        where: { brandId_templateId: { brandId, templateId } },
        select: { autoApproveDraft: true },
      }),
    ])

    if (!templateRaw) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const format = templateRaw.format ?? 'reel'
    const slotMap = Object.fromEntries(slots.map((s) => [s.key, s.content]))
    const autoApproveDraft = brandTemplateConfig?.autoApproveDraft ?? false
    const draftStatus = autoApproveDraft ? 'DRAFT_APPROVED' : 'DRAFT_PENDING'

    let creative: Record<string, unknown>

    const isHeadTalk = format === 'head_talk' || format === 'trial_head_talk'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templateScenes = (templateRaw as any).scenes as SceneDef[] | null | undefined

    if (isHeadTalk) {
      // HeadTalk: creative = { script, caption, hashtags }
      creative = {
        script: slotMap['script'] ?? '',
        caption,
        hashtags,
      }
    } else if (templateScenes && Array.isArray(templateScenes) && templateScenes.length > 0) {
      // DynamicReel: construct ResolvedSceneDef[] mapping manual inputs to resolvedContent
      const resolvedScenes = templateScenes.map((scene, si) => ({
        ...scene,
        texts: scene.texts.map((text, ti) => {
          const key = `scene_${si}_text_${ti}`
          // mode='manual' texts use their own content verbatim; prompt-mode texts come from user input
          const resolvedContent = text.mode === 'manual' ? text.content : (slotMap[key] ?? '')
          return { ...text, resolvedContent }
        }),
      }))
      creative = { scenes: resolvedScenes, caption, hashtags }
    } else {
      // Legacy slot-based: creative = { slots, caption, hashtags, brollMood }
      const slotRecord: Record<string, string> = {}
      const slotDefs = (templateRaw.slotSchema as Array<{ key: string }> | null) ?? []
      for (const slotDef of slotDefs) {
        slotRecord[slotDef.key] = slotMap[slotDef.key] ?? ''
      }
      creative = { slots: slotRecord, caption, hashtags, brollMood: '' }
    }

    const post = await prisma.post.create({
      data: {
        brandId,
        ideaText: '',
        format,
        creative: creative as unknown as Prisma.InputJsonValue,
        caption,
        hashtags,
        status: draftStatus,
        source: 'manual',
        templateId,
        postSynthesis: null,
        llmTrace: { manualCreation: true } as unknown as Prisma.InputJsonValue,
      },
    })

    logger.info({ postId: post.id, templateId, format }, '[ManualCreate] Post created manually')
    return NextResponse.json({ post }, { status: 200 })
  } catch (error: unknown) {
    logError('MANUAL_CREATE_POST_ERROR', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to create post', message }, { status: 500 })
  }
}
