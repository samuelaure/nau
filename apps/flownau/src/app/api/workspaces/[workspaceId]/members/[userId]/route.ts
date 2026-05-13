export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getValidToken } from '@/lib/auth'

const NAU_API_URL = process.env.NAU_API_URL ?? 'http://9nau-api:3000'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> },
) {
  const { workspaceId, userId } = await params
  const token = await getValidToken() ?? ''
  const res = await fetch(`${NAU_API_URL}/workspaces/${workspaceId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204) return new NextResponse(null, { status: 204 })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
