import { NextResponse } from 'next/server'

// Registration is now handled by 9naŭ API. This endpoint proxies the call
// and creates a local workspace for the new user.
export async function POST(req: Request) {
  try {
    const { name, email, password, workspaceName } = await req.json()

    if (!name || !email || !password || password.length < 8) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 })
    }

    const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
    const resp = await fetch(`${nauApiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        workspaceName: workspaceName ?? `${name}'s Workspace`,
      }),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return NextResponse.json(
        { message: (err as { message?: string }).message ?? 'Registration failed' },
        { status: resp.status },
      )
    }

    const { accessToken, refreshToken } = (await resp.json()) as {
      accessToken: string
      refreshToken: string
    }

    const response = NextResponse.json({ message: 'Account created successfully' })
    response.cookies.set('nau_access_token', accessToken, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 15,
    })
    response.cookies.set('nau_refresh_token', refreshToken, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return response
  } catch (error: unknown) {
    console.error('Registration Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
