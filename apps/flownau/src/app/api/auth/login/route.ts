import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password required' }, { status: 400 })
    }

    const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
    const resp = await fetch(`${nauApiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return NextResponse.json({ message: (err as { message?: string }).message ?? 'Invalid credentials' }, { status: resp.status })
    }

    const { accessToken, refreshToken } = (await resp.json()) as { accessToken: string; refreshToken: string }

    const response = NextResponse.json({ message: 'Login successful' })
    response.cookies.set('nau_access_token', accessToken, { httpOnly: true, path: '/', maxAge: 60 * 15 })
    response.cookies.set('nau_refresh_token', refreshToken, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 })
    return response
  } catch (error: unknown) {
    console.error('Login Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
