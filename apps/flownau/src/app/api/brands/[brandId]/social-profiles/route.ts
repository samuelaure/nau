export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccessForRoute } from '@/lib/auth'
import { validateServiceToken } from '@/modules/shared/nau-auth'
import { signServiceToken } from '@nau/auth'

/**
 * GET /api/brands/{brandId}/social-profiles
 * List all social profiles for a brand
 */
export async function GET(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params
    const user = await getAuthUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const denied = await checkBrandAccessForRoute(brandId)
    if (denied) return denied

    const profiles = await prisma.socialProfile.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ profiles })
  } catch (error) {
    console.error('[SOCIAL_PROFILES_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }
}

/**
 * POST /api/brands/{brandId}/social-profiles
 * Create a new social profile (soft add from flownau or nauthenticity sync)
 */
export async function POST(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params

    // Accept either user session or service JWT (nauthenticity sync)
    const isServiceCall = await validateServiceToken(req)
    if (!isServiceCall) {
      const user = await getAuthUser()
      if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const denied2 = await checkBrandAccessForRoute(brandId)
      if (denied2) return denied2
    }

    const body = await req.json()
    const {
      username,
      platform = 'instagram',
      platformId,
      profileImage,
      nauthenticityProfileId,
      syncedFromNauthenticity = false,
    } = body as {
      username?: string
      platform?: string
      platformId?: string | null
      profileImage?: string | null
      nauthenticityProfileId?: string | null
      syncedFromNauthenticity?: boolean
    }

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Dedup: prefer stable platformId, fall back to (brandId, username, platform).
    const existing = await prisma.socialProfile.findFirst({
      where: {
        brandId,
        platform,
        OR: [
          ...(platformId ? [{ platformId }] : []),
          ...(nauthenticityProfileId ? [{ nauthenticityProfileId }] : []),
          { username },
        ],
      },
    })

    if (existing) {
      // Backfill platformId / nauthenticityProfileId / image on existing rows when newly known.
      const patch: Record<string, unknown> = {}
      if (platformId && !existing.platformId) patch.platformId = platformId
      if (nauthenticityProfileId && !existing.nauthenticityProfileId)
        patch.nauthenticityProfileId = nauthenticityProfileId
      if (profileImage && !existing.profileImage) patch.profileImage = profileImage
      if (syncedFromNauthenticity && !existing.syncedFromNauthenticity)
        patch.syncedFromNauthenticity = true
      const profile =
        Object.keys(patch).length > 0
          ? await prisma.socialProfile.update({ where: { id: existing.id }, data: patch })
          : existing
      return NextResponse.json({ profile, deduped: true }, { status: 200 })
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand?.workspaceId) {
      return NextResponse.json({ error: 'Brand not found or invalid workspace' }, { status: 404 })
    }

    const profile = await prisma.socialProfile.create({
      data: {
        brandId,
        workspaceId: brand.workspaceId,
        username,
        platform,
        platformId: platformId ?? null,
        profileImage: profileImage ?? null,
        syncedFromNauthenticity,
        nauthenticityProfileId: nauthenticityProfileId || null,
        accessToken: null,
      },
    })

    // When a flownau user manually adds a profile, sync it to nauthenticity.
    // Skip if it came FROM nauthenticity (avoid loopback).
    if (!syncedFromNauthenticity && process.env.AUTH_SECRET) {
      const authSecret = process.env.AUTH_SECRET
      signServiceToken({ secret: authSecret, iss: 'flownau', aud: 'nauthenticity' })
        .then((token) =>
          fetch(
            `${process.env.NAUTHENTICITY_URL || 'http://localhost:3007'}/api/v1/social-profiles/sync`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                username,
                platform,
                platformId,
                brandId,
                workspaceId: brand.workspaceId,
              }),
            },
          ),
        )
        .catch((err) => console.warn('[SyncToNauthenticity] Failed:', err))
    }

    return NextResponse.json({ profile }, { status: 201 })
  } catch (error: unknown) {
    console.error('[SOCIAL_PROFILES_POST]', error)
    const msg = error instanceof Error ? error.message : 'Failed to create profile'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
