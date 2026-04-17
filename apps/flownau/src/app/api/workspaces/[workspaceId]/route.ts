export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'

async function getWorkspaceAccess(workspaceId: string, userId: string) {
  return prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  })
}

export async function PUT(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId } = await params
    const access = await getWorkspaceAccess(workspaceId, session.user.id)
    if (!access || !['owner', 'admin'].includes(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: body.name },
    })

    return NextResponse.json({ workspace })
  } catch {
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId } = await params
    const access = await getWorkspaceAccess(workspaceId, session.user.id)
    if (!access || access.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can delete a workspace' }, { status: 403 })
    }

    await prisma.workspace.delete({ where: { id: workspaceId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 })
  }
}
