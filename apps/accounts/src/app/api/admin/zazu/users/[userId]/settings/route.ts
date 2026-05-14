import { NextResponse } from 'next/server'
import { requireAdmin, ZAZU_INTERNAL_URL } from '../../../_lib'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const { userId } = await params
  const body = await req.json()

  const res = await fetch(`${ZAZU_INTERNAL_URL}/api/internal/admin/users/${userId}/settings`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: `Zazu returned ${res.status}` }, { status: 502 })
  return NextResponse.json(await res.json())
}
