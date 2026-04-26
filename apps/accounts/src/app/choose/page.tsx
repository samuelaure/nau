export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionFromCookieStore } from '@nau/auth'
import { AppPicker } from './AppPicker'

export default async function ChoosePage() {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (!session) redirect('/login')

  return <AppPicker />
}
