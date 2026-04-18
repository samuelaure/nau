import { requireAuth, getAuthUser } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { redirect } from 'next/navigation'
import WorkspaceSettingsClient from './WorkspaceSettingsClient'

export const dynamic = 'force-dynamic'

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: { workspaceId: string }
}) {
  const { workspaceId } = await params
  const user = await getAuthUser()
  if (!user?.id) redirect('/login')

  const workspaceUser = await prisma.workspaceUser.findUnique({
    where: { platformUserId_workspaceId: { platformUserId: user!.id, workspaceId } },
  })

  if (!workspaceUser) redirect('/dashboard')

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) redirect('/dashboard')

  const members = await prisma.workspaceUser.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <WorkspaceSettingsClient
      workspace={{ id: workspace.id, name: workspace.name }}
      currentUserId={user!.id}
      currentUserRole={workspaceUser.role}
      initialMembers={members.map((m) => ({
        id: m.id,
        platformUserId: m.platformUserId,
        role: m.role,
      }))}
    />
  )
}
