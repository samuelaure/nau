import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@nau/auth'

// ACCOUNTS_URL is server-only — middleware runs server-side so NEXT_PUBLIC_ is not needed
const ACCOUNTS_URL = process.env['ACCOUNTS_URL'] ?? process.env['NEXT_PUBLIC_ACCOUNTS_URL'] ?? 'https://accounts.9nau.com'

export async function middleware(request: NextRequest) {
  const session = await getSession(request)

  if (!session) {
    const loginUrl = new URL('/login', ACCOUNTS_URL)
    loginUrl.searchParams.set('redirect_uri', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|api/public).*)',
  ],
}
