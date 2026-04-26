export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')

    const templates = await prisma.template.findMany({
      where: brandId ? { brandId } : undefined,
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ templates }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body.brandId) {
      return NextResponse.json(
        { error: 'Missing brandId — templates are account-scoped' },
        { status: 400 },
      )
    }

    const template = await prisma.template.create({
      data: {
        name: body.name,
        remotionId: body.remotionId ?? 'default',
        brandId: body.brandId,
        scope: body.scope ?? 'account',
        schemaJson: body.schemaJson ?? null,
        contentSchema: body.contentSchema ?? null,
        systemPrompt: body.systemPrompt ?? null,
        creationPrompt: body.creationPrompt ?? null,
        captionPrompt: body.captionPrompt ?? null,
        sceneType: body.sceneType ?? null,
      },
    })
    return NextResponse.json({ template }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
