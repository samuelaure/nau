export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionFromCookieStore, COOKIE_ACCESS_TOKEN } from '@nau/auth'
import Link from 'next/link'

const NAU_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'
const ADMIN_EMAIL = process.env['ADMIN_EMAIL']

export default async function AdminPage() {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (!session) redirect('/login?redirect_uri=/admin')

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

  const links = [
    { href: '/admin/usage', label: 'Token Usage', description: 'LLM consumption by workspace, brand, service, and operation' },
    { href: '/admin/zazu', label: 'Zazu Bot', description: 'Manage Telegram bot users and send notifications' },
  ]

  return (
    <div className="min-h-screen bg-background text-white p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Admin</h1>
      <p className="text-sm text-white/40 mb-8">naŭ Platform administration</p>
      <div className="space-y-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block p-5 bg-panel border border-border rounded-2xl hover:border-accent/40 transition-colors group"
          >
            <div className="font-semibold text-white group-hover:text-accent transition-colors">{link.label}</div>
            <div className="text-sm text-white/40 mt-0.5">{link.description}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
