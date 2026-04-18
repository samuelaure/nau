export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'

async function requireAccess(workspaceId: string, platformUserId: string, requiredRoles = ['owner', 'admin']) {
  const access = await prisma.workspaceUser.findUnique({
    where: { platformUserId_workspaceId: { platformUserId, workspaceId } },
  })
  if (!access || !requiredRoles.includes(access.role)) return null
  return access
}

export async function GET(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await params
    const access = await requireAccess(workspaceId, user.id, ['owner', 'admin', 'member'])
    if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const members = await prisma.workspaceUser.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ members })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await params
    const access = await requireAccess(workspaceId, user.id)
    if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { platformUserId: inviteePlatformUserId, role = 'member' } = await req.json()
    if (!inviteePlatformUserId) return NextResponse.json({ error: 'Missing platformUserId' }, { status: 400 })

    const existing = await prisma.workspaceUser.findUnique({
      where: { platformUserId_workspaceId: { platformUserId: inviteePlatformUserId, workspaceId } },
    })
    if (existing?.role === 'owner') {
      return NextResponse.json({ error: 'Cannot modify workspace owner' }, { status: 400 })
    }

    const member = await prisma.workspaceUser.upsert({
      where: { platformUserId_workspaceId: { platformUserId: inviteePlatformUserId, workspaceId } },
      create: { platformUserId: inviteePlatformUserId, workspaceId, role },
      update: { role },
    })

    return NextResponse.json({ member }, { status: existing ? 200 : 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }
}
