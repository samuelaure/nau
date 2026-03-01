import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma' // Assuming a centralized prisma instance exists

export async function GET() {
  try {
    const templates = await prisma.videoTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ templates }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const template = await prisma.videoTemplate.create({
      data: {
        name: body.name,
        description: body.description ?? '',
        contentPrompt: body.contentPrompt ?? '',
        schemaJson: body.schemaJson ?? {},
        isActive: body.isActive ?? true,
        autoApproveCompositions: body.autoApproveCompositions ?? false,
      },
    })
    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
