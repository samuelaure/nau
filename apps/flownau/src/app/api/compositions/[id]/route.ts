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

    const updateData: {
      status?: string
      scheduledAt?: Date | null
      caption?: string
      hashtags?: string[]
      payload?: any
      creative?: any
    } = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.scheduledAt !== undefined)
      updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
    if (body.caption !== undefined) updateData.caption = body.caption
    if (body.hashtags !== undefined) updateData.hashtags = body.hashtags
    if (body.payload !== undefined) updateData.payload = body.payload
    if (body.creative !== undefined) updateData.creative = body.creative

    const composition = await prisma.composition.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ composition }, { status: 200 })
  } catch (error) {
    console.error('[UPDATE_COMPOSITION_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update composition' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await prisma.composition.delete({ where: { id } })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[DELETE_COMPOSITION_ERROR]', error)
    return NextResponse.json({ error: 'Failed to delete composition' }, { status: 500 })
  }
}
