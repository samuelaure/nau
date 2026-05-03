'use server'

import { cookies } from 'next/headers'
import {
  buildAccessTokenCookie,
  buildRefreshTokenCookie,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from '@nau/auth'

const NAU_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'
const COOKIE_DOMAIN = process.env['COOKIE_DOMAIN'] ?? '.9nau.com'
const IS_SECURE = process.env['NODE_ENV'] === 'production'

interface AuthResult {
  ok: true
  expiresIn: number
}

interface AuthError {
  ok: false
  message: string
}

async function callAuthEndpoint(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<AuthResult | AuthError> {
  let res: Response
  try {
    res = await fetch(`${NAU_API_URL}/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, message: 'Could not reach authentication server' }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { message?: string }
    return { ok: false, message: data.message ?? 'Authentication failed' }
  }

  // The 9naŭ API sets cookies directly on the response when running in server-side mode.
  // If it returns Set-Cookie headers, forward them. Otherwise, fall back to reading the
  // JSON body tokens (used when API and accounts are on different origins).
  const setCookieHeaders = res.headers.getSetCookie?.() ?? []
  const cookieStore = await cookies()

  if (setCookieHeaders.length > 0) {
    // Forward cookies from the API response
    for (const cookie of setCookieHeaders) {
      cookieStore.set(parseSetCookie(cookie))
    }
  } else {
    // API returned tokens in body (older behavior / cross-origin)
    const data = await res.json() as { accessToken?: string; refreshToken?: string; expiresIn?: number }
    if (data.accessToken) {
      const atCookie = buildAccessTokenCookie(data.accessToken, { domain: COOKIE_DOMAIN, secure: IS_SECURE })
      cookieStore.set(parseSetCookie(atCookie))
    }
    if (data.refreshToken) {
      const rtCookie = buildRefreshTokenCookie(data.refreshToken, { domain: COOKIE_DOMAIN, secure: IS_SECURE })
      cookieStore.set(parseSetCookie(rtCookie))
    }
    return { ok: true, expiresIn: data.expiresIn ?? 900 }
  }

  return { ok: true, expiresIn: 900 }
}

// Minimal Set-Cookie string parser for Next.js cookies().set()
function parseSetCookie(header: string): { name: string; value: string; [key: string]: unknown } {
  const [nameValue, ...attrs] = header.split(';').map((s) => s.trim())
  const eqIdx = nameValue.indexOf('=')
  const name = nameValue.slice(0, eqIdx)
  const value = nameValue.slice(eqIdx + 1)

  const attrMap: Record<string, string | boolean> = {}
  for (const attr of attrs) {
    const [k, v] = attr.split('=').map((s) => s.trim())
    attrMap[k.toLowerCase()] = v !== undefined ? v : true
  }

  return {
    name,
    value,
    httpOnly: 'httponly' in attrMap,
    secure: 'secure' in attrMap,
    sameSite: (attrMap['samesite'] as 'lax' | 'strict' | 'none') ?? 'lax',
    path: (attrMap['path'] as string) ?? '/',
    domain: attrMap['domain'] as string | undefined,
    maxAge: attrMap['max-age'] ? Number(attrMap['max-age']) : undefined,
  }
}

export async function loginAction(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return callAuthEndpoint('login', { email, password })
}

export async function registerAction(
  email: string,
  password: string,
  name?: string,
  inviteToken?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return callAuthEndpoint('register', { email, password, name, inviteToken })
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get(COOKIE_REFRESH_TOKEN)?.value

  if (refreshToken) {
    await fetch(`${NAU_API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined)
  }

  cookieStore.delete(COOKIE_ACCESS_TOKEN)
  cookieStore.delete(COOKIE_REFRESH_TOKEN)
}
