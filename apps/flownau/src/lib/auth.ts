import { getOrRefreshSessionFromCookieStore } from '@nau/auth'
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

const ADMIN_USER_IDS = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

export function isAdminUser(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId)
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (!isAdminUser(user.id)) redirect('/dashboard')
  return user
}

export function adminUnauthorized(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

async function getAuthContext(): Promise<{ user: AuthUser; token: string } | null> {
  const cookieStore = await cookies()
  const { session, token } = await getOrRefreshSessionFromCookieStore(cookieStore)
  if (!session || !token) return null
  return { user: { id: session.sub, workspaceId: session.workspaceId }, token }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  return (await getAuthContext())?.user ?? null
}

export async function getValidToken(): Promise<string | null> {
  return (await getAuthContext())?.token ?? null
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
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
  let workspaceIds: string[] = []
  try {
    const res = await fetch(`${nauApiUrl}/workspaces`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const workspaces = (await res.json()) as { id: string }[]
      workspaceIds = workspaces.map((w) => w.id)
    }
  } catch {
    // fall through — workspaceIds stays empty, brand lookup will fail → 403
  }

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId: { in: workspaceIds } },
  })
  if (!brand) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}
