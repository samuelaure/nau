import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@nau/auth'

const ACCOUNTS_URL = process.env['ACCOUNTS_URL'] ?? process.env['NEXT_PUBLIC_ACCOUNTS_URL'] ?? 'https://accounts.9nau.com'
// APP_URL must be the public-facing origin — request.url uses the internal bind address (0.0.0.0:3000)
const APP_URL = process.env['APP_URL'] ?? process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.9nau.com'

export async function middleware(request: NextRequest) {
  const session = await getSession(request)

  if (!session) {
    const loginUrl = new URL('/login', ACCOUNTS_URL)
    // Rewrite the origin from the internal bind address to the public APP_URL
    const publicRedirect = new URL(request.nextUrl.pathname + request.nextUrl.search, APP_URL)
    loginUrl.searchParams.set('redirect_uri', publicRedirect.toString())
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|api/public).*)',
  ],
}
