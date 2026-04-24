import { NextRequest, NextResponse } from 'next/server'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 20

const store = new Map<string, { count: number; resetAt: number }>()

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export function middleware(req: NextRequest) {
  const now = Date.now()
  const ip = getIp(req)
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
