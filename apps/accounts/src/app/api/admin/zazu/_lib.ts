import { cookies } from 'next/headers'
import { getSessionFromCookieStore, COOKIE_ACCESS_TOKEN, signServiceToken } from '@nau/auth'

export const NAU_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'
export const ZAZU_INTERNAL_URL = process.env['ZAZU_INTERNAL_URL'] ?? 'https://zazu.9nau.com'
const ADMIN_EMAIL = process.env['ADMIN_EMAIL']
const AUTH_SECRET = process.env['AUTH_SECRET'] ?? ''

export async function requireAdmin(): Promise<{ ok: true; token: string } | { ok: false; status: 401 | 403 }> {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (!session) return { ok: false, status: 401 }

  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  const meRes = await fetch(`${NAU_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!meRes.ok) return { ok: false, status: 401 }
  const me = await meRes.json() as { email: string }
  if (!ADMIN_EMAIL || me.email !== ADMIN_EMAIL) return { ok: false, status: 403 }

  const token = await signServiceToken({ iss: 'accounts', aud: 'zazu', secret: AUTH_SECRET })
  return { ok: true, token }
}
