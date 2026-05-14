export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionFromCookieStore, COOKIE_ACCESS_TOKEN, signServiceToken } from '@nau/auth'
import { AdminZazuDashboard, type ZazuUser } from './AdminZazuDashboard'

const NAU_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'
const ZAZU_INTERNAL_URL = process.env['ZAZU_INTERNAL_URL'] ?? 'https://zazu.9nau.com'
const ADMIN_EMAIL = process.env['ADMIN_EMAIL']
const AUTH_SECRET = process.env['AUTH_SECRET'] ?? ''

export default async function AdminZazuPage() {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (!session) redirect('/login?redirect_uri=/admin/zazu')

  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  const meRes = await fetch(`${NAU_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!meRes.ok) redirect('/login')
  const me = await meRes.json() as { email: string }

  if (!ADMIN_EMAIL || me.email !== ADMIN_EMAIL) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-white/30">Access denied.</p>
      </div>
    )
  }

  const token = await signServiceToken({ iss: 'accounts', aud: 'zazu', secret: AUTH_SECRET })
  const usersRes = await fetch(`${ZAZU_INTERNAL_URL}/api/internal/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const initialUsers: ZazuUser[] = usersRes.ok ? await usersRes.json() : []

  return <AdminZazuDashboard initialUsers={initialUsers} />
}
