export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.ideaText !== undefined) updateData.ideaText = body.ideaText
    if (body.format !== undefined) updateData.format = body.format

    const idea = await prisma.post.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ idea }, { status: 200 })
  } catch (error) {
    console.error('[UPDATE_IDEA_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update idea' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await prisma.post.delete({ where: { id } })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[DELETE_IDEA_ERROR]', error)
    return NextResponse.json({ error: 'Failed to delete idea' }, { status: 500 })
  }
}
