export const dynamic = 'force-dynamic'

import { Card } from '@/modules/shared/components/ui/Card'
import WorkspaceNameEditor from './WorkspaceNameEditor'
import TelegramLinkCard from './TelegramLinkCard'
import { cookies } from 'next/headers'
import { COOKIE_ACCESS_TOKEN } from '@nau/auth'

type NauWorkspace = { id: string; name: string; role: string }

async function getWorkspaces(token: string): Promise<NauWorkspace[]> {
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
  const res = await fetch(`${nauApiUrl}/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

async function getTelegramLinked(token: string): Promise<boolean> {
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
  const res = await fetch(`${nauApiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return false
  const user = (await res.json()) as { telegramId?: string | null }
  return !!user.telegramId
}

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value ?? ''
  const [workspaces, telegramLinked] = await Promise.all([
    getWorkspaces(token),
    getTelegramLinked(token),
  ])

  return (
    <div className="animate-fade-in max-w-2xl">
      <header className="mb-10">
        <h1 className="text-3xl font-heading font-semibold mb-2">Settings</h1>
        <p className="text-text-secondary">Manage your workspaces and integrations.</p>
      </header>

      <div className="flex flex-col gap-6">
        <TelegramLinkCard linked={telegramLinked} />

        {workspaces.length === 0 ? (
          <Card className="p-8 text-center text-text-secondary">No workspaces found.</Card>
        ) : (
          workspaces.map((ws) => (
            <Card key={ws.id} className="p-8">
              <h3 className="text-lg font-heading font-semibold mb-6">{ws.name}</h3>
              <WorkspaceNameEditor workspaceId={ws.id} currentName={ws.name} />
            </Card>
          ))
        )}
      </div>

      <p className="text-xs text-text-secondary mt-8">
        flownaŭ v{process.env.NEXT_PUBLIC_APP_VERSION}
      </p>
    </div>
  )
}
