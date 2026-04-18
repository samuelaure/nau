import { requireAuth } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { redirect } from 'next/navigation'
import { Card } from '@/modules/shared/components/ui/Card'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardRoot() {
  const authUser = await requireAuth()

  const workspaces = await prisma.workspaceUser.findMany({
    where: { platformUserId: authUser.id },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-20 animate-fade-in">
        <h2 className="text-2xl font-bold mb-4">No Workspaces Found</h2>
        <p className="text-text-secondary mb-8">You are not a member of any workspace.</p>
        <Link href="/" className="btn-primary px-6 py-2">Return Home</Link>
      </div>
    )
  }

  if (workspaces.length === 1) {
    redirect(`/dashboard/workspace/${workspaces[0].workspaceId}`)
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <header className="mb-10 text-center pt-10">
        <h1 className="text-3xl font-heading font-semibold mb-2">Select Workspace</h1>
        <p className="text-text-secondary">Choose a workspace to view its dashboard.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {workspaces.map((wu) => (
          <Link key={wu.workspace.id} href={`/dashboard/workspace/${wu.workspace.id}`}>
            <Card className="flex items-center justify-between p-6 hover:border-accent/50 transition-colors cursor-pointer group">
              <div>
                <h3 className="text-xl font-heading font-semibold mb-1 group-hover:text-accent transition-colors">
                  {wu.workspace.name}
                </h3>
                <p className="text-sm text-text-secondary capitalize">{wu.role} Role</p>
              </div>
              <ArrowRight className="text-text-secondary group-hover:text-accent transition-colors" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
