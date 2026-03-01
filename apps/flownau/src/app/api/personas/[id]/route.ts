import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const persona = await prisma.brandPersona.findUnique({
      where: { id: resolvedParams.id },
    })
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }
    return NextResponse.json({ persona }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch persona' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const body = await req.json()

    // If setting to default, clear others first
    if (body.isDefault && body.accountId) {
      await prisma.brandPersona.updateMany({
        where: {
          accountId: body.accountId,
          id: { not: resolvedParams.id },
        },
        data: { isDefault: false },
      })
    }

    const persona = await prisma.brandPersona.update({
      where: { id: resolvedParams.id },
      data: {
        name: body.name,
        systemPrompt: body.systemPrompt,
        ideasFrameworkPrompt: body.ideasFrameworkPrompt,
        isDefault: body.isDefault,
        autoApproveIdeas: body.autoApproveIdeas,
        autoApproveCompositions: body.autoApproveCompositions,
      },
    })
    return NextResponse.json({ persona }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    await prisma.brandPersona.delete({
      where: { id: resolvedParams.id },
    })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 })
  }
}
