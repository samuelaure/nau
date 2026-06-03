export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { recordPromptChange } from '@/modules/shared/prompt-history'
import { z } from 'zod'

const TextDefSchema = z.object({
  id: z.string(),
  mode: z.enum(['prompt', 'manual']),
  content: z.string(),
  font: z.string(),
  color: z.string(),
  maxTextSize: z.number(),
  textStyle: z.enum(['none', 'stroke', 'background_block']),
  styleColor: z.string(),
  horizontalAlign: z.enum(['left', 'center', 'right']),
  minWords: z.number().optional().nullable(),
  maxWords: z.number().optional().nullable(),
})

const SceneDefSchema = z.object({
  id: z.string(),
  backgroundVideoAssetId: z.string().nullable().optional(),
  backgroundVideoUrl: z.string().nullable().optional(),
  backgroundVideoDurationSecs: z.number().nullable().optional(),
  overlayColor: z.string(),
  overlayOpacity: z.number(),
  textVerticalAlign: z.enum(['top', 'center', 'bottom']),
  texts: z.array(TextDefSchema),
})

const ScenesArraySchema = z.array(SceneDefSchema)

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
    const promptFields = ['systemPrompt', 'creationPrompt', 'captionPrompt'] as const
    for (const f of promptFields) {
      if (body[f] !== undefined) {
        await recordPromptChange('template', resolvedParams.id, f, body[f])
      }
    }

    return NextResponse.json({ template }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const body = await req.json()
    const updateData: Record<string, unknown> = {}
    if (body.scenes !== undefined) {
      const parsedScenes = ScenesArraySchema.safeParse(body.scenes)
      if (!parsedScenes.success) {
        return NextResponse.json({ error: 'Invalid scenes format', details: parsedScenes.error }, { status: 400 })
      }
      updateData.scenes = parsedScenes.data
    }
    if (body.description !== undefined) updateData.description = body.description
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    const template = await prisma.template.update({
      where: { id: resolvedParams.id },
      data: updateData,
    })
    return NextResponse.json({ template }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to patch template' }, { status: 500 })
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
