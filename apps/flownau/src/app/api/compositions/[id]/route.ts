import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const composition = await prisma.composition.update({
      where: { id },
      data: { status: body.status },
    })

    return NextResponse.json({ composition }, { status: 200 })
  } catch (error) {
    console.error('[UPDATE_COMPOSITION_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update composition' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || !session.user) {
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
