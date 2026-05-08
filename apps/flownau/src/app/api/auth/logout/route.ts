import { NextResponse } from 'next/server'
import { buildClearCookies } from '@nau/auth'

const COOKIE_DOMAIN = process.env['COOKIE_DOMAIN'] ?? '.9nau.com'
const IS_SECURE = process.env['NODE_ENV'] === 'production'
const ACCOUNTS_URL = process.env['NEXT_PUBLIC_ACCOUNTS_URL'] ?? 'https://accounts.9nau.com'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  const clearHeaders = buildClearCookies({ domain: COOKIE_DOMAIN, secure: IS_SECURE })
  clearHeaders.forEach((h) => response.headers.append('Set-Cookie', h))
  return response
}
