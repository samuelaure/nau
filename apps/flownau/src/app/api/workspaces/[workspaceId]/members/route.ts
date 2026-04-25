export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_ACCESS_TOKEN } from '@nau/auth'

const NAU_API_URL = process.env.NAU_API_URL ?? 'http://9nau-api:3000'

async function getToken() {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_ACCESS_TOKEN)?.value ?? ''
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params
  const token = await getToken()
  const res = await fetch(`${NAU_API_URL}/workspaces/${workspaceId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => [])
  return NextResponse.json(data, { status: res.status })
}
