import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSessionFromCookieStore, COOKIE_ACCESS_TOKEN } from '@nau/auth'

const NAU_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json() as { token?: string }
  if (!token) return NextResponse.json({ message: 'Missing token' }, { status: 400 })

  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  const res = await fetch(`${NAU_API_URL}/auth/link-token/verify-from-accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token }),
  })

  const data = await res.json() as Record<string, unknown>
  return NextResponse.json(data, { status: res.status })
}
