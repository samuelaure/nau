import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@/generated/prisma'
import { runDraftPipeline } from '@/modules/composer/draft-pipeline'
import { getRecentDraftContext } from '@/modules/composer/recent-context.service'
import { triggerRenderForPost } from '@/modules/renderer/render-queue'
import { logError, logger } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const results: Array<{ postId: string; brandId: string; status: string; error?: string }> = []

    const approvedPosts = await prisma.post.findMany({
      where: { status: 'IDEA_APPROVED' },
      take: 20,
    })

    if (approvedPosts.length === 0) {
      return NextResponse.json({ message: 'No approved ideas to process', results: [] })
    }

    logger.info(`[Composer] Processing ${approvedPosts.length} approved posts`)

    for (const post of approvedPosts) {
      const format = post.format ?? 'reel'

      try {
        const templateLookupFormat = format === 'trial_reel' ? 'reel' : format
        const templateConfig = await prisma.brandTemplateConfig.findFirst({
          where: { brandId: post.brandId, enabled: true, template: { format: templateLookupFormat } },
          select: { autoApproveDraft: true, template: { select: { id: true } } },
          orderBy: { updatedAt: 'desc' },
        })

        if (!templateConfig?.template.id) {
          logger.warn({ postId: post.id, format }, '[Composer] No template found — skipping')
          results.push({ postId: post.id, brandId: post.brandId, status: 'skipped', error: 'No template found' })
          continue
        }

        const selectedTemplateId = templateConfig.template.id
        const autoApproveDraft = templateConfig.autoApproveDraft ?? false
        const draftStatus = autoApproveDraft ? 'DRAFT_APPROVED' : 'DRAFT_PENDING'

        const recentContext = await getRecentDraftContext(post.brandId)

        const result = await runDraftPipeline({
          ideaText: post.ideaText ?? '',
          brandId: post.brandId,
          templateId: selectedTemplateId,
          recentContext,
        })

        await prisma.post.update({
          where: { id: post.id },
          data: {
            format: result.format,
            creative: result.creative as Prisma.InputJsonValue,
            caption: result.caption,
            hashtags: result.hashtags,
            templateId: result.templateId,
            status: draftStatus,
            llmTrace: { draftTrace: result.trace } as unknown as Prisma.InputJsonValue,
          },
        })

        if (autoApproveDraft) {
          await triggerRenderForPost(post.id).catch((err) =>
            logger.error({ postId: post.id, err }, '[Composer] triggerRenderForPost failed'),
          )
        }

        results.push({ postId: post.id, brandId: post.brandId, status: 'success' })
        logger.info(`[Composer] Composed post ${post.id} (${result.format}, ${draftStatus})`)
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
