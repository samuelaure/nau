import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET ?? 'changeme'
const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://flownau.9nau.com'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = pathname.startsWith('/dashboard')

  const token = request.cookies.get('nau_token')?.value

  let isAuthenticated = false
  if (token) {
    try {
      const secret = new TextEncoder().encode(JWT_SECRET)
      await jwtVerify(token, secret)
      isAuthenticated = true
    } catch {
      isAuthenticated = false
    }
  }

  if (isProtected && !isAuthenticated) {
    const callbackUrl = `${APP_URL}/auth/callback`
    const loginUrl = new URL('/login', ACCOUNTS_URL)
    loginUrl.searchParams.set('continue', callbackUrl)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|auth/callback|.*\\.png$).*)'],
}
