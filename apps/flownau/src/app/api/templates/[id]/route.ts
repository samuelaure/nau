import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const template = await prisma.videoTemplate.findUnique({
      where: { id: resolvedParams.id },
    })
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json({ template }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const body = await req.json()
    const template = await prisma.videoTemplate.update({
      where: { id: resolvedParams.id },
      data: {
        name: body.name,
        description: body.description,
        contentPrompt: body.contentPrompt,
        schemaJson: body.schemaJson,
        isActive: body.isActive,
        autoApproveCompositions: body.autoApproveCompositions,
      },
    })
    return NextResponse.json({ template }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    await prisma.videoTemplate.delete({
      where: { id: resolvedParams.id },
    })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
