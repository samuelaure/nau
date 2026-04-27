import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import type { Prisma } from '@prisma/client'
import { compose } from '@/modules/composer/scene-composer'
import { selectAssetsForCreative, commitAssetUsage } from '@/modules/composer/asset-curator'
import { compileTimeline } from '@/modules/composer/timeline-compiler'
import { addRenderJob } from '@/modules/renderer/render-queue'
import { selectTemplateForIdea } from '@/modules/composer/template-selector'
import { generateTopicHash } from '@/modules/planning/daily-plan.service'
import { logError, logger } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'
import type { ContentFormat } from '@/types/content'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const USER_MANAGED_FORMATS: ReadonlySet<string> = new Set(['head_talk', 'replicate'])

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const results: Array<{
      postId: string
      brandId: string
      status: string
      error?: string
    }> = []

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
      const format: ContentFormat = (post.format as ContentFormat) || 'reel'
      const persona = post.brandPersona

      try {
        const selectedTemplate = await selectTemplateForIdea({ brandId: post.brandId, format })

        // Check auto-approve: persona flag or BrandTemplateConfig
        let autoApproveDraft = persona?.autoApproveCompositions ?? false
        if (!autoApproveDraft && selectedTemplate) {
          const config = await prisma.brandTemplateConfig.findUnique({
            where: { brandId_templateId: { brandId: post.brandId, templateId: selectedTemplate.id } },
            select: { autoApproveDraft: true },
          })
          autoApproveDraft = config?.autoApproveDraft ?? false
        }

        const draftStatus = autoApproveDraft ? 'DRAFT_APPROVED' : 'DRAFT_PENDING'
        const topicHash = generateTopicHash(post.ideaText)

        if (USER_MANAGED_FORMATS.has(format)) {
          await prisma.post.update({
            where: { id: post.id },
            data: {
              format,
              payload: {} as unknown as Prisma.InputJsonValue,
              caption: post.ideaText.slice(0, 2000),
              templateId: selectedTemplate?.id ?? null,
              topicHash,
              status: draftStatus,
            },
          })
          results.push({ postId: post.id, brandId: post.brandId, status: 'success' })
          logger.info(`[Composer] Updated post ${post.id} as user-managed ${format}`)
          continue
        }

        const { creative } = await compose({
          ideaText: post.ideaText,
          brandId: post.brandId,
          format,
          personaId: persona?.id,
          templateContentSchema: selectedTemplate?.contentSchema ?? null,
          templateSystemPrompt: selectedTemplate?.systemPrompt ?? null,
        })

        const { sceneAssets, audioAsset } = await selectAssetsForCreative(creative, post.brandId, 30)
        const brandStyle = { primaryColor: '#6C63FF', accentColor: '#FF6584', fontFamily: 'sans-serif' }
        const { schema } = compileTimeline(creative, sceneAssets, audioAsset, brandStyle, format)

        const sceneTypes = creative.scenes.map((s: { type: string }) => s.type)

        const updatedPost = await prisma.post.update({
          where: { id: post.id },
          data: {
            format,
            creative: creative as unknown as Prisma.InputJsonValue,
            payload: schema as unknown as Prisma.InputJsonValue,
            caption: creative.caption,
            hashtags: creative.hashtags,
            templateId: selectedTemplate?.id ?? null,
            sceneTypes,
            topicHash,
            status: draftStatus,
            brandPersonaId: persona?.id ?? null,
          },
        })

        const usedAssetIds = [...sceneAssets.values()].map((a) => a.id)
        if (audioAsset) usedAssetIds.push(audioAsset.id)
        await commitAssetUsage(usedAssetIds)

        // If auto-approved draft, also check autoApprovePost (rendered) and enqueue
        const autoApprovePost = selectedTemplate
          ? ((await prisma.brandTemplateConfig.findUnique({
              where: { brandId_templateId: { brandId: post.brandId, templateId: selectedTemplate.id } },
              select: { autoApprovePost: true },
            }))?.autoApprovePost ?? false)
          : false

        if (autoApproveDraft && autoApprovePost) {
          await prisma.post.update({ where: { id: updatedPost.id }, data: { status: 'RENDERING' } })
          await prisma.renderJob.create({
            data: { postId: updatedPost.id, status: 'queued', outputType: 'video' },
          })
          await addRenderJob(updatedPost.id)
        }

        results.push({ postId: post.id, brandId: post.brandId, status: 'success' })
        logger.info(`[Composer] Updated post ${post.id} (${creative.scenes.length} scenes, ${draftStatus})`)
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
