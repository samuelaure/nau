import { NextResponse } from 'next/server'
import { requireAdmin, ZAZU_INTERNAL_URL } from '../_lib'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const res = await fetch(`${ZAZU_INTERNAL_URL}/api/internal/admin/users`, {
    headers: { Authorization: `Bearer ${auth.token}` },
    cache: 'no-store',
  })
  if (!res.ok) return NextResponse.json({ error: `Zazu returned ${res.status}` }, { status: 502 })
  return NextResponse.json(await res.json())
}
