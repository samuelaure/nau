import { getSession } from '@nau/auth/nextjs'
import { NextRequest, NextResponse } from 'next/server'

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://flownau.9nau.com'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = pathname.startsWith('/dashboard')

  if (isProtected) {
    const session = await getSession(request)
    if (!session) {
      const loginUrl = new URL('/login', ACCOUNTS_URL)
      loginUrl.searchParams.set('continue', `${APP_URL}/auth/callback`)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|auth/callback|.*\\.png$).*)'],
}
