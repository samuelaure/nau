export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionFromCookieStore, COOKIE_ACCESS_TOKEN } from '@nau/auth'
import { AppPicker } from './AppPicker'

const NAU_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'
const ADMIN_EMAIL = process.env['ADMIN_EMAIL']

export default async function ChoosePage() {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (!session) redirect('/login')

  let isAdmin = false
  if (ADMIN_EMAIL) {
    const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
    const meRes = await fetch(`${NAU_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (meRes.ok) {
      const me = await meRes.json() as { email: string }
      isAdmin = me.email === ADMIN_EMAIL
    }
  }

  return <AppPicker isAdmin={isAdmin} />
}
