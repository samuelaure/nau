import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET ?? 'changeme'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = pathname.startsWith('/dashboard')
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')

  const token = request.cookies.get('nau_access_token')?.value

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
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
