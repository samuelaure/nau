export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'

/**
 * GET /api/v1/service/social-profiles/:profileId/published-posts
 * Called by nauthenticity during "Sync Profile" to backfill published posts
 * that may have missed the real-time sync (e.g. due to errors at publish time).
 * Auth: service JWT (iss: nauthenticity, aud: flownau)
 */
export async function GET(req: Request, { params }: { params: Promise<{ profileId: string }> }) {
  if (!(await validateServiceToken(req))) return unauthorizedResponse()

  const { profileId } = await params

  const profiles = await prisma.socialProfile.findMany({
    where: { nauthenticityProfileId: profileId },
    select: { brandId: true },
  })
  if (profiles.length === 0) {
    return NextResponse.json([])
  }

  const brandIds = profiles.map((p) => p.brandId)

  const posts = await prisma.post.findMany({
    where: {
      brandId: { in: brandIds },
      status: 'PUBLISHED',
      externalPostUrl: { not: null },
    },
    select: {
      id: true,
      externalPostId: true,
      externalPostUrl: true,
      caption: true,
      publishedAt: true,
      postSynthesis: true,
      videoUrl: true,
      coverUrl: true,
      format: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 500,
  })

  return NextResponse.json(
    posts.map((p) => ({
      flownauPostId: p.id,
      externalPostId: p.externalPostId,
      url: p.externalPostUrl!,
      caption: p.caption,
      publishedAt: p.publishedAt!.toISOString(),
      postSynthesis: p.postSynthesis,
      videoUrl: p.videoUrl,
      coverUrl: p.coverUrl,
      format: p.format,
    })),
  )
}
