export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getValidToken } from '@/lib/auth'

const NAU_API_URL = process.env.NAU_API_URL ?? 'http://9nau-api:3000'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params
  const token = (await getValidToken()) ?? ''
  const res = await fetch(`${NAU_API_URL}/workspaces/${workspaceId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => [])
  return NextResponse.json(data, { status: res.status })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params
  const token = (await getValidToken()) ?? ''
  const body = await req.json()
  const res = await fetch(`${NAU_API_URL}/workspaces/${workspaceId}/members`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
