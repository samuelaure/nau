import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSessionFromCookieStore, COOKIE_ACCESS_TOKEN } from '@nau/auth'
import { signServiceToken } from '@nau/auth'

const NAU_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'
const ZAZU_INTERNAL_URL = process.env['ZAZU_INTERNAL_URL'] ?? 'https://zazu.9nau.com'
const ADMIN_EMAIL = process.env['ADMIN_EMAIL']
const AUTH_SECRET = process.env['AUTH_SECRET'] ?? ''

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  const meRes = await fetch(`${NAU_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!meRes.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = await meRes.json() as { email: string }
  if (!ADMIN_EMAIL || me.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { telegramId, message } = await req.json() as { telegramId?: string; message?: string }
  if (!telegramId || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const token = await signServiceToken({ iss: 'accounts', aud: 'zazu', secret: AUTH_SECRET })
  const res = await fetch(`${ZAZU_INTERNAL_URL}/api/internal/admin/message`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramId, message }),
  })
  if (!res.ok) return NextResponse.json({ ok: false, error: `Zazu returned ${res.status}` }, { status: 502 })
  return NextResponse.json({ ok: true, sent: 1 })
}
