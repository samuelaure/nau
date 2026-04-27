import { NextRequest, NextResponse } from 'next/server'
import { getOrRefreshSession } from '@nau/auth/nextjs'

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com'
const FLOWNAU_URL = process.env.NEXT_PUBLIC_FLOWNAU_URL ?? 'https://flownau.9nau.com'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { session, newCookies } = await getOrRefreshSession(request)

  // Landing page: redirect authenticated users straight to the dashboard.
  if (pathname === '/') {
    if (session) {
      const res = NextResponse.redirect(new URL('/dashboard', request.url))
      newCookies?.forEach((c) => res.headers.append('Set-Cookie', c))
      return res
    }
    return NextResponse.next()
  }

  // Protected routes.
  if (pathname.startsWith('/dashboard') && !session) {
    const loginUrl = new URL('/login', ACCOUNTS_URL)
    loginUrl.searchParams.set('continue', `${FLOWNAU_URL}/auth/callback`)
    return NextResponse.redirect(loginUrl)
  }

  const res = NextResponse.next()
  newCookies?.forEach((c) => res.headers.append('Set-Cookie', c))
  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|auth/callback|.*\\.png$).*)'],
}
