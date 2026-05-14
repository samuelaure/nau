import { NextResponse } from 'next/server'
import { requireAdmin, ZAZU_INTERNAL_URL } from '../../../_lib'

export async function GET(
  _req: Request,
  { params, searchParams }: { params: Promise<{ userId: string }>; searchParams?: URLSearchParams },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const { userId } = await params
  const url = new URL(_req.url)
  const before = url.searchParams.get('before')
  const limit = url.searchParams.get('limit')

  const qs = new URLSearchParams()
  if (before) qs.set('before', before)
  if (limit) qs.set('limit', limit)

  const res = await fetch(
    `${ZAZU_INTERNAL_URL}/api/internal/admin/users/${userId}/chat?${qs}`,
    { headers: { Authorization: `Bearer ${auth.token}` }, cache: 'no-store' },
  )
  if (!res.ok) return NextResponse.json({ error: `Zazu returned ${res.status}` }, { status: 502 })
  return NextResponse.json(await res.json())
}
