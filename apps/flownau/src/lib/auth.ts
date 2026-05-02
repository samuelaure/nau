import { getSessionFromCookieStore, COOKIE_ACCESS_TOKEN } from '@nau/auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export interface AuthUser {
  id: string // 9naŭ User.id (JWT sub)
  workspaceId: string
}

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com'
const FLOWNAU_URL = process.env.NEXT_PUBLIC_FLOWNAU_URL ?? 'https://flownau.9nau.com'

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (!session) return null
  return { id: session.sub, workspaceId: session.workspaceId }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) {
    const callbackUrl = `${FLOWNAU_URL}/auth/callback`
    redirect(`${ACCOUNTS_URL}/login?continue=${encodeURIComponent(callbackUrl)}`)
  }
  return user
}

/**
 * For use in Route Handlers — checks auth + brand ownership.
 * Returns a 401/403 NextResponse on failure, or null on success (so the handler can continue).
 * Usage: const denied = await checkBrandAccessForRoute(brandId); if (denied) return denied;
 */
export async function checkBrandAccessForRoute(brandId: string): Promise<NextResponse | null> {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  let workspaceIds: string[] = []
  if (token) {
    try {
      const res = await fetch(`${nauApiUrl}/workspaces`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const workspaces = (await res.json()) as { id: string }[]
        workspaceIds = workspaces.map((w) => w.id)
      }
    } catch {
      // fall through — workspaceIds stays empty, brand lookup will fail → 403
    }
  }

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId: { in: workspaceIds } },
  })
  if (!brand) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}
