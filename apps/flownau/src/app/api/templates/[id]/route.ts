export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const template = await prisma.template.findUnique({
      where: { id: resolvedParams.id },
    })
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json({ template }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const body = await req.json()
    const template = await prisma.template.update({
      where: { id: resolvedParams.id },
      data: {
        name: body.name,
        remotionId: body.remotionId,
        scope: body.scope,
        schemaJson: body.schemaJson,
        contentSchema: body.contentSchema,
        systemPrompt: body.systemPrompt,
        creationPrompt: body.creationPrompt,
        captionPrompt: body.captionPrompt,
        sceneType: body.sceneType,
        previewUrl: body.previewUrl,
        previewThumbnailUrl: body.previewThumbnailUrl,
        description: body.description,
      },
    })
    return NextResponse.json({ template }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    await prisma.template.delete({
      where: { id: resolvedParams.id },
    })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
