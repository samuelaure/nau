export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionFromCookieStore } from '@nau/auth'
import { LoginForm } from './LoginForm'

const DEFAULT_REDIRECT = '/choose'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const redirectTo = params['redirect_uri'] ?? params['continue'] ?? DEFAULT_REDIRECT

  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (session) redirect(redirectTo)

  return <LoginForm />
}
