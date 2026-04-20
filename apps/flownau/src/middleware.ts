import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'changeme'
const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://flownau.9nau.com'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = pathname.startsWith('/dashboard')

  const token = request.cookies.get('nau_token')?.value

  let isAuthenticated = false
  if (token) {
    try {
      const secret = new TextEncoder().encode(AUTH_SECRET)
      await jwtVerify(token, secret)
      isAuthenticated = true
    } catch {
      isAuthenticated = false
    }
  }

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', ACCOUNTS_URL)
    loginUrl.searchParams.set('continue', `${APP_URL}${pathname}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|auth/callback|.*\\.png$).*)'],
}
