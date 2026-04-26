import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { publishComposition } from '@/modules/publisher/publish-orchestrator'
import { logError } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes — publishing only, no rendering

/**
 * GET /api/cron/publisher
 *
 * Publish rendered compositions to Instagram via the unified orchestrator.
 * This cron ONLY handles Instagram API calls — rendering is decoupled (BullMQ)
 * and slot assignment is handled by /api/cron/scheduler.
 *
 * Phase 18: gate reads BrandTemplateConfig.autoApprovePost for (brandId, templateId).
 */
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  try {
    const results: Array<{
      type: string
      compositionId?: string
      brandId?: string
      status: string
      error?: string
    }> = []
    const now = new Date()

    // Find RENDERED compositions whose scheduledAt has arrived.
    const dueCompositions = await prisma.composition.findMany({
      where: {
        status: { in: ['RENDERED', 'rendered', 'PUBLISHING', 'SCHEDULED'] },
        scheduledAt: { lte: now },
        publishAttempts: { lt: 3 },
      },
      include: {
        brand: { include: { socialProfiles: true } },
        template: {
          include: {
            brandConfigs: true,
          },
        },
      },
    })

    for (const composition of dueCompositions) {
      if (
        !composition.brand?.socialProfiles?.[0] ||
        !composition.brand.socialProfiles[0].accessToken ||
        !composition.brand.socialProfiles[0].platformId
      ) {
        continue
      }

      // Phase 18 gate: resolve BrandTemplateConfig.autoApprovePost for (brandId, templateId).
      // Fallback to false (manual Final Review) if no config row or no template.
      const templateConfig = composition.template?.brandConfigs?.find(
        (c) => c.brandId === composition.brandId,
      )
      const autoApprovePost = templateConfig?.autoApprovePost ?? false

      // PUBLISHING was set by the manual Final Review endpoint; always proceed.
      if (!autoApprovePost && composition.status !== 'PUBLISHING') {
        continue
      }

      try {
        const result = await publishComposition({
          ...composition,
          socialProfile: composition.brand.socialProfiles[0],
        })
        if (result.success) {
          await prisma.contentPlanner.updateMany({
            where: { brandId: composition.brandId, isDefault: true },
            data: { lastPostedAt: now },
          })
          results.push({ type: 'explicit', compositionId: composition.id, status: 'success' })
        } else {
          throw new Error(result.error || 'Unknown publish error')
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        logError(`[Publisher] Publish failed for ${composition.id}`, err)
        const attempts = composition.publishAttempts + 1
        await prisma.composition.update({
          where: { id: composition.id },
          data: {
            publishAttempts: attempts,
            lastPublishError: errMsg,
            status: attempts >= 3 ? 'failed' : composition.status,
          },
        })
        results.push({
          type: 'explicit',
          compositionId: composition.id,
          status: 'failed',
          error: errMsg,
        })
      }
    }

    return NextResponse.json({ message: 'Publisher Execution Finished', results })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Publisher] Fatal error', error)
    return NextResponse.json({ error: 'Fatal publisher failure', details: msg }, { status: 500 })
  }
}
