export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> },
) {
  try {
    const user = await getAuthUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId, userId } = await params

    const requester = await prisma.workspaceUser.findUnique({
      where: { platformUserId_workspaceId: { platformUserId: user.id, workspaceId } },
    })

    const isSelf = user.id === userId
    const hasAdminAccess = requester && ['owner', 'admin'].includes(requester.role)

    if (!isSelf && !hasAdminAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const target = await prisma.workspaceUser.findUnique({
      where: { platformUserId_workspaceId: { platformUserId: userId, workspaceId } },
    })
    if (target?.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove workspace owner' }, { status: 400 })
    }

    await prisma.workspaceUser.delete({
      where: { platformUserId_workspaceId: { platformUserId: userId, workspaceId } },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
