'use server'

import { prisma } from '@/modules/shared/prisma'
import { checkAuth } from '@/modules/shared/actions'
import { revalidatePath } from 'next/cache'

/**
 * Add a social profile (soft add for later OAuth authorization)
 */
export async function addSocialProfile(
  brandId: string,
  username: string,
  platform: string = 'instagram',
  nauthenticityProfileId?: string,
) {
  const { user } = await checkAuth()
  if (!user?.id) throw new Error('Unauthorized')

  const brand = await prisma.brand.findUnique({ where: { id: brandId } })
  if (!brand) throw new Error('Brand not found')

  // Check if already exists
  const existing = await prisma.socialProfile.findFirst({
    where: { brandId, username, platform },
  })

  if (existing) {
    throw new Error('Profile already exists for this brand')
  }

  const profile = await prisma.socialProfile.create({
    data: {
      brandId,
      workspaceId: brand.workspaceId,
      username,
      platform,
      syncedFromNauthenticity: !!nauthenticityProfileId,
      nauthenticityProfileId: nauthenticityProfileId || null,
      accessToken: null,
    },
  })

  revalidatePath(`/dashboard/workspace/${brand.workspaceId}`)
  return profile
}

/**
 * Get authorization status for a social profile
 */
export async function getSocialProfileStatus(profileId: string) {
  const profile = await prisma.socialProfile.findUnique({
    where: { id: profileId },
  })

  if (!profile) throw new Error('Profile not found')

  return {
    id: profile.id,
    username: profile.username,
    platform: profile.platform,
    hasToken: !!profile.accessToken,
    status: profile.accessToken ? 'authorized' : 'needs-authorization',
    syncedFromNauthenticity: profile.syncedFromNauthenticity,
  }
}

/**
 * Update OAuth tokens for a social profile (called after OAuth redirect)
 */
export async function updateSocialProfileTokens(
  profileId: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date,
) {
  const { user } = await checkAuth()
  if (!user?.id) throw new Error('Unauthorized')

  const profile = await prisma.socialProfile.findUnique({
    where: { id: profileId },
  })

  if (!profile) throw new Error('Profile not found')

  // Verify user has access to this brand
  const brand = await prisma.brand.findUnique({
    where: { id: profile.brandId },
  })

  if (!brand) throw new Error('Brand not found')

  const updated = await prisma.socialProfile.update({
    where: { id: profileId },
    data: {
      accessToken,
      refreshToken: refreshToken || null,
      expiresAt: expiresAt || null,
      tokenExpiresAt: expiresAt || null,
      tokenRefreshedAt: new Date(),
    },
  })

  revalidatePath(`/dashboard/workspace/${brand.workspaceId}`)
  return updated
}

/**
 * Delete a social profile
 */
export async function deleteSocialProfile(profileId: string) {
  const { user } = await checkAuth()
  if (!user?.id) throw new Error('Unauthorized')

  const profile = await prisma.socialProfile.findUnique({
    where: { id: profileId },
  })

  if (!profile) throw new Error('Profile not found')

  await prisma.socialProfile.delete({
    where: { id: profileId },
  })

  const brand = await prisma.brand.findUnique({
    where: { id: profile.brandId },
  })

  if (brand) {
    revalidatePath(`/dashboard/workspace/${brand.workspaceId}`)
  }
}
