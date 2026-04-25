import { verifyAccessToken, AuthError } from '../core'
import { COOKIE_ACCESS_TOKEN, COOKIE_REFRESH_TOKEN, buildAccessTokenCookie, buildRefreshTokenCookie } from '../cookies'
import type { AccessTokenPayload } from '@nau/types'

// Minimal shape matching NextRequest — avoids hard dependency on 'next'
interface NextRequestLike {
  cookies: { get(name: string): { value: string } | undefined }
  url: string
}

function getSecret(): string {
  const secret = process.env['AUTH_SECRET']
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return secret
}

export async function getSession(request: NextRequestLike): Promise<AccessTokenPayload | null> {
  const token = request.cookies.get(COOKIE_ACCESS_TOKEN)?.value
  if (!token) return null
  try {
    return await verifyAccessToken(token, getSecret())
  } catch {
    return null
  }
}

export async function requireSession(request: NextRequestLike): Promise<AccessTokenPayload> {
  const session = await getSession(request)
  if (!session) {
    const loginUrl = new URL('/login', process.env['NEXT_PUBLIC_ACCOUNTS_URL'] ?? 'https://accounts.9nau.com')
    loginUrl.searchParams.set('redirect_uri', request.url)
    throw Object.assign(new Error('Unauthenticated'), { redirect: loginUrl.toString() })
  }
  return session
}

// For use in Next.js server actions (reads from cookies() API)
export async function getSessionFromCookieStore(cookieStore: {
  get(name: string): { value: string } | undefined
}): Promise<AccessTokenPayload | null> {
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  if (!token) return null
  try {
    return await verifyAccessToken(token, getSecret())
  } catch (err) {
    if (err instanceof AuthError && err.code === 'EXPIRED') return null
    return null
  }
}

export interface RefreshResult {
  session: AccessTokenPayload | null
  /** Set-Cookie header strings to forward on the response when a refresh occurred. */
  newCookies?: string[]
}

/**
 * Attempts to verify the access token. If it is expired and a refresh token is
 * present, silently calls the auth API to rotate tokens. Returns the session and,
 * when a refresh occurred, the new Set-Cookie strings that must be applied to the
 * outgoing response so the browser receives the updated tokens.
 */
export async function getOrRefreshSession(request: NextRequestLike): Promise<RefreshResult> {
  const at = request.cookies.get(COOKIE_ACCESS_TOKEN)?.value

  if (at) {
    try {
      const session = await verifyAccessToken(at, getSecret())
      return { session }
    } catch (err) {
      // Only attempt refresh on expiry — other errors mean the token is corrupt/tampered.
      if (!(err instanceof AuthError && err.code === 'EXPIRED')) {
        return { session: null }
      }
    }
  }

  // Access token absent or expired — try the refresh token.
  const rt = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value
  if (!rt) return { session: null }

  const apiUrl = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'
  try {
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the refresh token as a cookie so the API endpoint reads it the
        // same way it does from a browser request.
        Cookie: `${COOKIE_REFRESH_TOKEN}=${rt}`,
      },
    })

    if (!res.ok) return { session: null }

    const cookieDomain = process.env['COOKIE_DOMAIN'] ?? '.9nau.com'
    const isSecure = process.env['NODE_ENV'] === 'production'

    // Prefer Set-Cookie headers forwarded directly by the API.
    const apiSetCookies = res.headers.getSetCookie?.() ?? []
    if (apiSetCookies.length > 0) {
      const atHeader = apiSetCookies.find((h) => h.startsWith(`${COOKIE_ACCESS_TOKEN}=`))
      if (!atHeader) return { session: null }
      const newAt = atHeader.split(';')[0].split('=').slice(1).join('=')
      const session = await verifyAccessToken(newAt, getSecret())
      return { session, newCookies: apiSetCookies }
    }

    // Fallback: tokens returned in the JSON body.
    const data = (await res.json()) as { accessToken?: string; refreshToken?: string }
    if (!data.accessToken) return { session: null }

    const session = await verifyAccessToken(data.accessToken, getSecret())
    const newCookies = [
      buildAccessTokenCookie(data.accessToken, { domain: cookieDomain, secure: isSecure }),
    ]
    if (data.refreshToken) {
      newCookies.push(buildRefreshTokenCookie(data.refreshToken, { domain: cookieDomain, secure: isSecure }))
    }
    return { session, newCookies }
  } catch {
    return { session: null }
  }
}
