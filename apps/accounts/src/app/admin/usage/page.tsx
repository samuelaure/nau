export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionFromCookieStore, COOKIE_ACCESS_TOKEN } from '@nau/auth'
import { UsageDashboard } from './UsageDashboard'

const NAU_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'
const ADMIN_EMAIL = process.env['ADMIN_EMAIL']

export default async function AdminUsagePage() {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (!session) redirect('/login?redirect_uri=/admin/usage')

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

  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const summaryRes = await fetch(`${NAU_API_URL}/admin/usage/summary?from=${from}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const initialData = summaryRes.ok ? await summaryRes.json() : null

  return <UsageDashboard initialData={initialData} accessToken={accessToken ?? ''} apiUrl={NAU_API_URL} />
}
