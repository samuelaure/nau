import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card } from '@/modules/shared/components/ui/Card'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

type NauWorkspace = { id: string; name: string; role: string }

async function getWorkspacesFromNau(token: string): Promise<NauWorkspace[]> {
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
  try {
    const res = await fetch(`${nauApiUrl}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function DashboardRoot() {
  await requireAuth()

  const cookieStore = await cookies()
  const token = cookieStore.get('nau_token')?.value ?? ''
  const workspaces = await getWorkspacesFromNau(token)

  if (workspaces.length === 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.9nau.com'
    return (
      <div className="flex flex-col items-center justify-center pt-20 animate-fade-in">
        <h2 className="text-2xl font-bold mb-4">No Workspaces Found</h2>
        <p className="text-text-secondary mb-8">
          Create a workspace in the 9naŭ Platform to get started.
        </p>
        <a
          href={`${appUrl}/settings`}
          target="_blank"
          rel="noreferrer"
          className="btn-primary px-6 py-2"
        >
          Open 9naŭ Settings
        </a>
      </div>
    )
  }

  if (workspaces.length === 1) {
    redirect(`/dashboard/workspace/${workspaces[0].id}`)
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <header className="mb-10 text-center pt-10">
        <h1 className="text-3xl font-heading font-semibold mb-2">Select Workspace</h1>
        <p className="text-text-secondary">Choose a workspace to view its dashboard.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {workspaces.map((ws) => (
          <Link key={ws.id} href={`/dashboard/workspace/${ws.id}`}>
            <Card className="flex items-center justify-between p-6 hover:border-accent/50 transition-colors cursor-pointer group">
              <div>
                <h3 className="text-xl font-heading font-semibold mb-1 group-hover:text-accent transition-colors">
                  {ws.name}
                </h3>
                <p className="text-sm text-text-secondary capitalize">{ws.role} Role</p>
              </div>
              <ArrowRight className="text-text-secondary group-hover:text-accent transition-colors" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
