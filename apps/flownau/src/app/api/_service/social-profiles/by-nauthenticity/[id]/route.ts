export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { validateServiceToken } from '@/modules/shared/nau-auth'

/**
 * PATCH /api/_service/social-profiles/by-nauthenticity/:id
 * Service-only: update flownau SocialProfile metadata by nauthenticityProfileId.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ok = await validateServiceToken(req)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: nauthenticityProfileId } = await params
  const body = await req.json().catch(() => ({}))
  const { platformId, profileImage, username, platform } = body as {
    platformId?: string | null
    profileImage?: string | null
    username?: string
    platform?: string
  }

  const existing = await prisma.socialProfile.findFirst({ where: { nauthenticityProfileId } })
  if (!existing) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const updated = await prisma.socialProfile.update({
    where: { id: existing.id },
    data: {
      ...(platformId !== undefined ? { platformId } : {}),
      ...(profileImage !== undefined ? { profileImage } : {}),
      ...(username !== undefined ? { username } : {}),
      ...(platform !== undefined ? { platform } : {}),
    },
  })

  return NextResponse.json({ profile: updated })
}
