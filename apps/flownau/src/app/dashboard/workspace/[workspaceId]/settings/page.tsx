import { auth } from '@/auth'
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
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const workspaceUser = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  })

  if (!workspaceUser) redirect('/dashboard')

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) redirect('/dashboard')

  const members = await prisma.workspaceUser.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <WorkspaceSettingsClient
      workspace={{ id: workspace.id, name: workspace.name }}
      currentUserId={session.user.id}
      currentUserRole={workspaceUser.role}
      initialMembers={members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        user: m.user,
      }))}
    />
  )
}
