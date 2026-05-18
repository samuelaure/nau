export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { signServiceToken } from '@nau/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const nauthenticityUrl = process.env.NAUTHENTICITY_URL ?? 'http://nauthenticity:3000'
  const authSecret = process.env.AUTH_SECRET ?? ''

  const svcToken = await signServiceToken({
    secret: authSecret,
    iss: 'flownau',
    aud: 'nauthenticity',
  })
  const res = await fetch(`${nauthenticityUrl}/api/v1/_service/source-concepts/${id}`, {
    headers: { Authorization: `Bearer ${svcToken}` },
  })

  if (!res.ok) return NextResponse.json(null, { status: res.status })
  return NextResponse.json(await res.json())
}
