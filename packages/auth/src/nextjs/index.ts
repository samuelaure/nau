import { verifyAccessToken, AuthError } from '../core'
import { COOKIE_ACCESS_TOKEN } from '../cookies'
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
