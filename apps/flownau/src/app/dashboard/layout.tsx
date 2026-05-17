import TelegramBanner from '@/modules/shared/components/TelegramBanner'
import DashboardShell from '@/modules/shared/components/DashboardShell'
import { bootstrapSystem } from '@/modules/shared/bootstrap'
import { cookies } from 'next/headers'
import { COOKIE_ACCESS_TOKEN } from '@nau/auth'

export const dynamic = 'force-dynamic'

async function isTelegramLinked(token: string): Promise<boolean> {
  if (!token) return true
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
  try {
    const res = await fetch(`${nauApiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return true
    const user = await res.json() as { telegramId?: string | null }
    return !!user.telegramId
  } catch {
    return true
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await bootstrapSystem()
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value ?? ''
  const telegramLinked = await isTelegramLinked(token)

  return (
    <DashboardShell>
      {!telegramLinked && <TelegramBanner />}
      {children}
    </DashboardShell>
  )
}
