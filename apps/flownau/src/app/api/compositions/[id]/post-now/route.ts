export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'
import { publishComposition } from '@/modules/publisher/publish-orchestrator'

/**
 * POST /api/compositions/[id]/post-now
 *
 * Manually trigger immediate publishing for a ready (RENDERED_APPROVED) post.
 * Uses the same publishComposition orchestrator as the scheduled cron publisher,
 * so the result is identical to an automated publish — including setting publishedAt.
 *
 * The post must be in RENDERED_APPROVED status and the brand must have at least one
 * authorised social profile.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        brand: { include: { socialProfiles: true } },
      },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const PUBLISHABLE_STATUSES = new Set(['RENDERED_APPROVED', 'RENDERED_PENDING'])
    if (!PUBLISHABLE_STATUSES.has(post.status)) {
      return NextResponse.json(
        { error: `Post is not ready to publish (status: ${post.status})` },
        { status: 422 },
      )
    }

    const profile = post.brand?.socialProfiles?.[0]
    if (!profile?.accessToken || !profile?.platformId) {
      return NextResponse.json(
        { error: 'No authorised social profile found for this brand' },
        { status: 422 },
      )
    }

    const result = await publishComposition({
      id: post.id,
      brandId: post.brandId,
      format: post.format ?? '',
      videoUrl: post.videoUrl,
      coverUrl: post.coverUrl,
      caption: post.caption,
      hashtags: post.hashtags,
      socialProfile: {
        id: profile.id,
        accessToken: profile.accessToken,
        platformId: profile.platformId,
        tokenExpiresAt: profile.tokenExpiresAt,
      },
    })

    if (!result.success) {
      // Increment attempt counter and surface the error
      await prisma.post.update({
        where: { id: post.id },
        data: {
          publishAttempts: { increment: 1 },
          lastPublishError: result.error ?? 'Unknown publish error',
        },
      })
      return NextResponse.json({ error: result.error ?? 'Publish failed' }, { status: 502 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[POST_NOW_ERROR]', error)
    return NextResponse.json({ error: 'Failed to publish post' }, { status: 500 })
  }
}
