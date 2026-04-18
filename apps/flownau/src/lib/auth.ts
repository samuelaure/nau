import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export interface AuthUser {
  id: string    // 9naŭ User.id (JWT sub)
  email: string
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'changeme'

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('nau_access_token')?.value
  if (!token) return null

  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    if (!payload.sub || !payload.email) return null
    return { id: payload.sub, email: payload.email as string }
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  return user
}
