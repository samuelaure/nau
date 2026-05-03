export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccessForRoute } from '@/lib/auth'

/**
 * GET /api/brands/{brandId}/social-profiles
 * List all social profiles for a brand
 */
export async function GET(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params
    const user = await getAuthUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const denied = await checkBrandAccessForRoute(brandId); if (denied) return denied

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
    const user = await getAuthUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const denied2 = await checkBrandAccessForRoute(brandId); if (denied2) return denied2

    const body = await req.json()
    const { username, platform = 'instagram', nauthenticityProfileId, syncedFromNauthenticity = false } = body

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Check if profile already exists
    const existing = await prisma.socialProfile.findFirst({
      where: { brandId, username, platform },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Profile already exists for this brand', profile: existing },
        { status: 409 },
      )
    }

    // Get workspace for this brand
    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand?.workspaceId) {
      return NextResponse.json({ error: 'Brand not found or invalid workspace' }, { status: 404 })
    }

    // Create soft profile (no tokens yet)
    const profile = await prisma.socialProfile.create({
      data: {
        brandId,
        workspaceId: brand.workspaceId,
        username,
        platform,
        syncedFromNauthenticity,
        nauthenticityProfileId: nauthenticityProfileId || null,
        // accessToken is null — will be filled after OAuth
        accessToken: null,
      },
    })

    // Sync to nauthenticity asynchronously (don't block response)
    if (!syncedFromNauthenticity) {
      fetch(`${process.env.NAUTHENTICITY_URL || 'http://localhost:3007'}/api/v1/social-profiles/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nau-Service-Key': process.env.NAU_SERVICE_KEY || '',
        },
        body: JSON.stringify({
          username,
          platform: 'instagram',
          brandId,
          workspaceId: brand.workspaceId,
        }),
      }).catch((err) => {
        // Silently fail — sync is nice-to-have
        console.warn('[SyncToNauthenticity] Failed:', err)
      })
    }

    return NextResponse.json({ profile }, { status: 201 })
  } catch (error: unknown) {
    console.error('[SOCIAL_PROFILES_POST]', error)
    const msg = error instanceof Error ? error.message : 'Failed to create profile'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
