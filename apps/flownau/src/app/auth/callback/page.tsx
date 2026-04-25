export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionFromCookieStore } from '@nau/auth'

export default async function AuthCallbackPage() {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)

  if (session) {
    redirect('/dashboard')
  } else {
    redirect('/')
  }
}
