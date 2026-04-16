export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma' // Assuming a centralized prisma instance exists

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
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
    const template = await prisma.template.create({
      data: {
        name: body.name,
        remotionId: body.remotionId ?? 'default',
        schemaJson: body.schemaJson ?? {},
        systemPrompt: body.systemPrompt ?? '',
        creationPrompt: body.creationPrompt ?? '',
      },
    })
    return NextResponse.json({ template }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
