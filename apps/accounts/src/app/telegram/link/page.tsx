export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionFromCookieStore } from '@nau/auth'
import { TelegramLinkConfirm } from './TelegramLinkConfirm'

export default async function TelegramLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const token = params['token']

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <p className="text-lg font-medium">Enlace inválido</p>
          <p className="text-sm text-muted-foreground">No se proporcionó un token de vinculación.</p>
        </div>
      </div>
    )
  }

  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)

  if (!session) {
    redirect(`/login?redirect_uri=/telegram/link?token=${token}`)
  }

  return <TelegramLinkConfirm token={token} />
}
