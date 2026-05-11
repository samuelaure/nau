import Sidebar from '@/modules/shared/components/Sidebar'
import TelegramBanner from '@/modules/shared/components/TelegramBanner'
import { bootstrapSystem } from '@/modules/shared/bootstrap'
import { cookies } from 'next/headers'
import { COOKIE_ACCESS_TOKEN } from '@nau/auth'

export const dynamic = 'force-dynamic'

async function isTelegramLinked(token: string): Promise<boolean> {
  if (!token) return true // don't show banner if not authed
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
    return true // fail silently — don't block layout render
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await bootstrapSystem()
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value ?? ''
  const telegramLinked = await isTelegramLinked(token)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main
        style={{
          marginLeft: '320px',
          padding: '40px',
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {!telegramLinked && <TelegramBanner />}
        {children}
      </main>
    </div>
  )
}
