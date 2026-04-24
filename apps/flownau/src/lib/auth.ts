import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export interface AuthUser {
  id: string // 9naŭ User.id (JWT sub)
  email: string
}

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? 'https://accounts.9nau.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://flownau.9nau.com'

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET environment variable is required')
  return secret
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('nau_token')?.value
  if (!token) return null

  try {
    const secret = new TextEncoder().encode(getAuthSecret())
    const { payload } = await jwtVerify(token, secret)
    if (!payload.sub || !payload.email) return null
    return { id: payload.sub, email: payload.email as string }
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) {
    const callbackUrl = `${APP_URL}/auth/callback`
    redirect(`${ACCOUNTS_URL}/login?continue=${encodeURIComponent(callbackUrl)}`)
  }
  return user
}
