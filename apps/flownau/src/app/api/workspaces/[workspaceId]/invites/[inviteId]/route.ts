export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getValidToken } from '@/lib/auth'

const NAU_API_URL = process.env.NAU_API_URL ?? 'http://9nau-api:3000'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; inviteId: string }> },
) {
  const { workspaceId, inviteId } = await params
  const token = await getValidToken() ?? ''
  const res = await fetch(
    `${NAU_API_URL}/workspaces/${workspaceId}/invites/${inviteId}/regenerate`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
  )
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; inviteId: string }> },
) {
  const { workspaceId, inviteId } = await params
  const token = await getValidToken() ?? ''
  const res = await fetch(
    `${NAU_API_URL}/workspaces/${workspaceId}/invites/${inviteId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  )
  if (res.status === 204) return new NextResponse(null, { status: 204 })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
