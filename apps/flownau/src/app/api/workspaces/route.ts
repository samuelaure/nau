export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getValidToken } from '@/lib/auth'

const NAU_API_URL = process.env.NAU_API_URL || 'https://api.9nau.com'

export async function GET() {
  const token = await getValidToken()
  const res = await fetch(`${NAU_API_URL}/workspaces`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return NextResponse.json([], { status: res.status })
  const data = await res.json()
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const token = await getValidToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const res = await fetch(`${NAU_API_URL}/workspaces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
