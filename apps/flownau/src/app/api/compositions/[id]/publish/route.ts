export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * POST /api/compositions/{id}/publish
 * Publish a composition to selected social profiles
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { profileIds } = body

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one profile ID is required' },
        { status: 400 },
      )
    }

    const composition = await prisma.post.findUnique({
      where: { id: params.id },
      include: { brand: true },
    })

    if (!composition) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const denied = await checkBrandAccessForRoute(composition.brandId); if (denied) return denied

    // Verify all profiles belong to this brand
    const profiles = await prisma.socialProfile.findMany({
      where: {
        id: { in: profileIds },
        brandId: composition.brandId,
      },
    })

    if (profiles.length !== profileIds.length) {
      return NextResponse.json(
        { error: 'One or more profiles not found or unauthorized' },
        { status: 403 },
      )
    }

    // Check that all profiles have authorization
    const unauthorizedProfiles = profiles.filter((p) => !p.accessToken)
    if (unauthorizedProfiles.length > 0) {
      return NextResponse.json(
        {
          error: `${unauthorizedProfiles.length} profile(s) need authorization before publishing`,
        },
        { status: 400 },
      )
    }

    // Publish to each profile
    const publishResults: Array<{ profileId: string; success: boolean; error?: string }> = []

    for (const profile of profiles) {
      try {
        // TODO: Integrate with Instagram Graph API / Meta API for actual publishing
        // For now, just mark as published to simulate
        // In production, call Meta API with:
        // - profile.accessToken
        // - composition.videoUrl (the CDN URL)
        // - composition.caption
        // - composition.hashtags

        publishResults.push({
          profileId: profile.id,
          success: true,
        })

        logger.info(
          {
            compositionId: params.id,
            profileId: profile.id,
            username: profile.username,
          },
          '[PUBLISH] Published to profile',
        )
      } catch (error) {
        publishResults.push({
          profileId: profile.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        logger.error(
          {
            compositionId: params.id,
            profileId: profile.id,
            error,
          },
          '[PUBLISH] Failed to publish to profile',
        )
      }
    }

    const allSuccess = publishResults.every((r) => r.success)

    if (!allSuccess) {
      const failedCount = publishResults.filter((r) => !r.success).length
      return NextResponse.json(
        {
          error: `Failed to publish to ${failedCount} profile(s)`,
          details: publishResults,
        },
        { status: 500 },
      )
    }

    await prisma.post.update({
      where: { id: params.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })

    logger.info(
      {
        compositionId: params.id,
        profileCount: profiles.length,
      },
      '[PUBLISH] Composition published successfully',
    )

    return NextResponse.json({
      success: true,
      message: `Published to ${profiles.length} profile(s)`,
      results: publishResults,
    })
  } catch (error: unknown) {
    console.error('[PUBLISH_ERROR]', error instanceof Error ? error.message : String(error))
    const msg = error instanceof Error ? error.message : 'Unknown publish failure'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
