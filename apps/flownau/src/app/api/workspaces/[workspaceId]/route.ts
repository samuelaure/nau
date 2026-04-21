export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const NAU_API_URL = process.env.NAU_API_URL ?? 'http://9nau-api:3000'

async function getToken() {
  const cookieStore = await cookies()
  return cookieStore.get('nau_token')?.value ?? ''
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params
  const token = await getToken()
  const body = await req.json()
  const res = await fetch(`${NAU_API_URL}/api/workspaces/${workspaceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}

export async function PUT() {
  return NextResponse.json({ error: 'Use PATCH to rename a workspace.' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Workspace deletion is not supported.' }, { status: 405 })
}
