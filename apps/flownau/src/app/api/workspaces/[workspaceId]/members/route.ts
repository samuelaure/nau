export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'

async function requireAccess(
  workspaceId: string,
  userId: string,
  requiredRoles = ['owner', 'admin'],
) {
  const access = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  })
  if (!access || !requiredRoles.includes(access.role)) return null
  return access
}

/** GET /api/workspaces/[workspaceId]/members — List all members */
export async function GET(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await params
    const access = await requireAccess(workspaceId, session.user.id, ['owner', 'admin', 'member'])
    if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const members = await prisma.workspaceUser.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ members })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

/** POST /api/workspaces/[workspaceId]/members — Add/invite a user by email */
export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await params
    const access = await requireAccess(workspaceId, session.user.id)
    if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email, role = 'member' } = await req.json()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const invitee = await prisma.user.findUnique({ where: { email } })
    if (!invitee) {
      return NextResponse.json(
        { error: `No account found for ${email}. The user must sign up first.` },
        { status: 404 },
      )
    }

    // Prevent downgrading/overwriting owners
    const existing = await prisma.workspaceUser.findUnique({
      where: { userId_workspaceId: { userId: invitee.id, workspaceId } },
    })
    if (existing?.role === 'owner') {
      return NextResponse.json({ error: 'Cannot modify workspace owner' }, { status: 400 })
    }

    const member = await prisma.workspaceUser.upsert({
      where: { userId_workspaceId: { userId: invitee.id, workspaceId } },
      create: { userId: invitee.id, workspaceId, role },
      update: { role },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    })

    return NextResponse.json({ member }, { status: existing ? 200 : 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }
}
