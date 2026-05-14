import { NextResponse } from 'next/server'
import { requireAdmin, ZAZU_INTERNAL_URL } from '../_lib'

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const { telegramId, message } = await req.json() as { telegramId?: string; message?: string }
  if (!telegramId || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const res = await fetch(`${ZAZU_INTERNAL_URL}/api/internal/admin/message`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramId, message }),
  })
  if (!res.ok) return NextResponse.json({ ok: false, error: `Zazu returned ${res.status}` }, { status: 502 })
  return NextResponse.json({ ok: true, sent: 1 })
}
