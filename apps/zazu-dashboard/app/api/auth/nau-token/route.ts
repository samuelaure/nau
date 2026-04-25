import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyAccessToken } from '@nau/auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('nau_at')?.value
  if (!token) return NextResponse.json({ token: null })

  try {
    await verifyAccessToken(token, process.env.AUTH_SECRET ?? 'changeme')
    return NextResponse.json({ token })
  } catch {
    return NextResponse.json({ token: null })
  }
}
