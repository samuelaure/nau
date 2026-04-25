import { NextRequest, NextResponse } from 'next/server'
import { getOrRefreshSession } from '@nau/auth/nextjs'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 20
const DEFAULT_REDIRECT = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.9nau.com'

const store = new Map<string, { count: number; resetAt: number }>()

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // On the login page, silently refresh an expired session and skip the form.
  if (pathname === '/login') {
    const { session, newCookies } = await getOrRefreshSession(req)
    if (session) {
      const params = req.nextUrl.searchParams
      const redirectTo = params.get('redirect_uri') ?? params.get('continue') ?? DEFAULT_REDIRECT
      const res = NextResponse.redirect(redirectTo)
      newCookies?.forEach((c) => res.headers.append('Set-Cookie', c))
      return res
    }
  }

  // Rate limiting for auth endpoints.
  const now = Date.now()
  const ip = getIp(req)

  if (ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') {
    return NextResponse.next()
  }

  const key = `rl:${ip}`
  let entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS }
    store.set(key, entry)
  }
  entry.count++

  if (entry.count > MAX_REQUESTS) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/login', '/register', '/api/:path*'],
}
