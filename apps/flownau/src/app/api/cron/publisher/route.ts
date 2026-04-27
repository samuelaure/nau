import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { publishComposition } from '@/modules/publisher/publish-orchestrator'
import { logError } from '@/modules/shared/logger'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: Request) {
  if (!validateCronSecret(request)) return unauthorizedCronResponse()

  try {
    const results: Array<{ postId?: string; brandId?: string; status: string; error?: string }> = []
    const now = new Date()

    const duePosts = await prisma.post.findMany({
      where: {
        status: { in: ['RENDERED_APPROVED', 'PUBLISHING', 'SCHEDULED'] },
        scheduledAt: { lte: now },
        publishAttempts: { lt: 3 },
      },
      include: {
        brand: { include: { socialProfiles: true } },
        template: { include: { brandConfigs: true } },
      },
    })

    for (const post of duePosts) {
      if (
        !post.brand?.socialProfiles?.[0] ||
        !post.brand.socialProfiles[0].accessToken ||
        !post.brand.socialProfiles[0].platformId
      ) {
        continue
      }

      const templateConfig = post.template?.brandConfigs?.find((c) => c.brandId === post.brandId)
      const autoApprovePost = templateConfig?.autoApprovePost ?? false

      if (!autoApprovePost && post.status !== 'PUBLISHING') continue

      try {
        const profile = post.brand.socialProfiles[0]
        if (!profile.accessToken) continue
        const result = await publishComposition({
          ...post,
          format: post.format ?? '',
          socialProfile: { ...profile, accessToken: profile.accessToken },
        })
        if (result.success) {
          await prisma.contentPlanner.updateMany({
            where: { brandId: post.brandId, isDefault: true },
            data: { lastPostedAt: now },
          })
          results.push({ postId: post.id, status: 'success' })
        } else {
          throw new Error(result.error || 'Unknown publish error')
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        logError(`[Publisher] Publish failed for ${post.id}`, err)
        const attempts = post.publishAttempts + 1
        await prisma.post.update({
          where: { id: post.id },
          data: {
            publishAttempts: attempts,
            lastPublishError: errMsg,
            status: attempts >= 3 ? 'PUBLISHING' : post.status,
          },
        })
        results.push({ postId: post.id, status: 'failed', error: errMsg })
      }
    }

    return NextResponse.json({ message: 'Publisher Execution Finished', results })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[Publisher] Fatal error', error)
    return NextResponse.json({ error: 'Fatal publisher failure', details: msg }, { status: 500 })
  }
}
