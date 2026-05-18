import { signServiceToken } from '@nau/auth'
import { prisma } from '../shared/prisma'
import { config } from '../../config'
import { wlog } from '../../utils/worker-logger'

const FLOWNAU_URL = (config.env as any).FLOWNAU_URL || 'http://localhost:3003'
const AUTH_SECRET = (config.env as any).AUTH_SECRET || ''

async function token(): Promise<string> {
  return signServiceToken({ secret: AUTH_SECRET, iss: 'nauthenticity', aud: 'flownau' })
}

/**
 * Push profile metadata (image, platformId, username) to flownau for owned profiles.
 * No-op if the profile has no owner or AUTH_SECRET is missing.
 */
export async function pushProfileMetadataToFlownau(socialProfileId: string): Promise<void> {
  if (!AUTH_SECRET) return
  const profile = await prisma.socialProfile.findUnique({
    where: { id: socialProfileId },
    select: { id: true, ownerId: true, externalId: true, profileImageUrl: true, username: true, platform: true },
  })
  if (!profile || !profile.ownerId) return

  try {
    const t = await token()
    const res = await fetch(`${FLOWNAU_URL}/api/_service/social-profiles/by-nauthenticity/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({
        platformId: profile.externalId ?? null,
        profileImage: profile.profileImageUrl ?? null,
        username: profile.username,
        platform: profile.platform,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok && res.status !== 404) {
      wlog.warn(`[FlownauSync] metadata push for ${profile.username} returned ${res.status}`)
    }
  } catch (err) {
    wlog.warn(`[FlownauSync] metadata push failed for ${profile.username}: ${err}`)
  }
}
