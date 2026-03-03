import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json()
    const { id } = await params

    if (body.isDefault && body.accountId) {
      await (prisma as any).ideasFramework.updateMany({
        where: { accountId: body.accountId },
        data: { isDefault: false },
      })
    }

    const framework = await (prisma as any).ideasFramework.update({
      where: { id },
      data: {
        name: body.name,
        systemPrompt: body.systemPrompt,
        isDefault: body.isDefault ?? false,
      },
    })
    return NextResponse.json({ framework }, { status: 200 })
  } catch (error) {
    console.error('[IDEAS_FRAMEWORK_PUT]', error)
    return NextResponse.json({ error: 'Failed to update framework' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await (prisma as any).ideasFramework.delete({
      where: { id },
    })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[IDEAS_FRAMEWORK_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete framework' }, { status: 500 })
  }
}
