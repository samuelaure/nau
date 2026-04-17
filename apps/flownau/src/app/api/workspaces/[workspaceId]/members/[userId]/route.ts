export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'

/** DELETE /api/workspaces/[workspaceId]/members/[userId] — Remove a collaborator */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId, userId } = await params

    const requester = await prisma.workspaceUser.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
    })

    // Allow removal if requester is owner/admin, or removing themselves
    const isSelf = session.user.id === userId
    const hasAdminAccess = requester && ['owner', 'admin'].includes(requester.role)

    if (!isSelf && !hasAdminAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Owners cannot be removed
    const target = await prisma.workspaceUser.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    })
    if (target?.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove workspace owner' }, { status: 400 })
    }

    await prisma.workspaceUser.delete({
      where: { userId_workspaceId: { userId, workspaceId } },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
