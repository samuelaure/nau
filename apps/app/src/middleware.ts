import { NextRequest, NextResponse } from 'next/server'
import { getOrRefreshSession } from '@nau/auth/nextjs'

const ACCOUNTS_URL = process.env['ACCOUNTS_URL'] ?? process.env['NEXT_PUBLIC_ACCOUNTS_URL'] ?? 'https://accounts.9nau.com'
const APP_URL = process.env['APP_URL'] ?? process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.9nau.com'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { session, newCookies } = await getOrRefreshSession(request)

  // Landing page: redirect authenticated users straight to the dashboard.
  if (pathname === '/') {
    if (session) {
      const res = NextResponse.redirect(new URL('/home', request.url))
      newCookies?.forEach((c) => res.headers.append('Set-Cookie', c))
      return res
    }
    return NextResponse.next()
  }

  // All other routes require authentication.
  if (!session) {
    const loginUrl = new URL('/login', ACCOUNTS_URL)
    const publicRedirect = new URL(pathname + request.nextUrl.search, APP_URL)
    loginUrl.searchParams.set('redirect_uri', publicRedirect.toString())
    return NextResponse.redirect(loginUrl)
  }

  const res = NextResponse.next()
  newCookies?.forEach((c) => res.headers.append('Set-Cookie', c))
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|api/public).*)',
  ],
}
