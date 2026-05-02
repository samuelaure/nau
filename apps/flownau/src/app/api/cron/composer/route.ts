import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@/generated/prisma'
import { composeReel } from '@/modules/composer/reel-composer'
import { composeHeadTalk } from '@/modules/composer/headtalk-composer'
import { triggerRenderForPost } from '@/modules/renderer/render-queue'
import type { ContentFormat } from '@/types/content'
import { logError, logger } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const REEL_FORMATS = new Set(['reel', 'trial_reel'])

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const results: Array<{ postId: string; brandId: string; status: string; error?: string }> = []

    const approvedPosts = await prisma.post.findMany({
      where: { status: 'IDEA_APPROVED' },
      include: { brandPersona: true },
      take: 20,
    })

    if (approvedPosts.length === 0) {
      return NextResponse.json({ message: 'No approved ideas to process', results: [] })
    }

    logger.info(`[Composer] Processing ${approvedPosts.length} approved posts`)

    for (const post of approvedPosts) {
      const format = (post.format ?? 'reel') as ContentFormat
      const persona = post.brandPersona

      try {
        // trial_reel uses the same templates as reel
        const templateLookupFormat = format === 'trial_reel' ? 'reel' : format
        const templateConfig = await prisma.brandTemplateConfig.findFirst({
          where: { brandId: post.brandId, enabled: true, template: { format: templateLookupFormat } },
          select: { autoApproveDraft: true, customPrompt: true, template: { select: { id: true } } },
          orderBy: { updatedAt: 'desc' },
        })
        const selectedTemplateId = templateConfig?.template.id ?? null

        let autoApproveDraft = persona?.autoApproveCompositions ?? false
        if (!autoApproveDraft && templateConfig) {
          autoApproveDraft = templateConfig.autoApproveDraft ?? false
        }

        const draftStatus = autoApproveDraft ? 'DRAFT_APPROVED' : 'DRAFT_PENDING'

        let creative: unknown
        let caption = ''
        let hashtags: string[] = []
        let resolvedTemplateId: string | null = selectedTemplateId

        if (REEL_FORMATS.has(format) && selectedTemplateId) {
          const reelResult = await composeReel({
            ideaText: post.ideaText ?? '',
            brandId: post.brandId,
            templateId: selectedTemplateId,
            personaId: persona?.id,
            customPrompt: templateConfig?.customPrompt ?? null,
          })
          creative = { slots: reelResult.slots, caption: reelResult.caption, hashtags: reelResult.hashtags, brollMood: reelResult.brollMood }
          caption = reelResult.caption
          hashtags = reelResult.hashtags
        } else {
          const headTalkResult = await composeHeadTalk({
            ideaText: post.ideaText ?? '',
            brandId: post.brandId,
            templateId: selectedTemplateId ?? undefined,
            personaId: persona?.id,
          })
          creative = headTalkResult.creative
          caption = headTalkResult.caption
          hashtags = headTalkResult.hashtags
          resolvedTemplateId = headTalkResult.templateId
        }

        await prisma.post.update({
          where: { id: post.id },
          data: {
            format,
            creative: creative as Prisma.InputJsonValue,
            caption,
            hashtags,
            templateId: resolvedTemplateId,
            status: draftStatus,
            brandPersonaId: persona?.id ?? null,
          },
        })

        if (autoApproveDraft) {
          await triggerRenderForPost(post.id).catch((err) =>
            logger.error({ postId: post.id, err }, '[Composer] triggerRenderForPost failed'),
          )
        }

        results.push({ postId: post.id, brandId: post.brandId, status: 'success' })
        logger.info(`[Composer] Composed post ${post.id} (${format}, ${draftStatus})`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logError(`[Composer] Failed to compose post ${post.id}`, err)
        results.push({ postId: post.id, brandId: post.brandId, status: 'failed', error: msg })
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
