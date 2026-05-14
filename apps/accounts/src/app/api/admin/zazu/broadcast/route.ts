import { NextResponse } from 'next/server'
import { requireAdmin, ZAZU_INTERNAL_URL } from '../_lib'

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const { message } = await req.json() as { message?: string }
  if (!message) return NextResponse.json({ error: 'Missing message' }, { status: 400 })

  const res = await fetch(`${ZAZU_INTERNAL_URL}/api/internal/admin/broadcast`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) return NextResponse.json({ ok: false, error: `Zazu returned ${res.status}` }, { status: 502 })
  const data = await res.json() as { sent: number }
  return NextResponse.json({ ok: true, sent: data.sent })
}
