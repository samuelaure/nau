export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })

    const principles = await prisma.contentCreationPrinciples.findMany({
      where: { brandId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ principles }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch content principles' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { brandId, workspaceId, name, systemPrompt, isDefault } = body

    if (!brandId || !brandId || !workspaceId || !name || !systemPrompt) {
      return NextResponse.json(
        { error: 'Missing brandId, workspaceId, name, or systemPrompt' },
        { status: 400 },
      )
    }

    if (isDefault) {
      await prisma.contentCreationPrinciples.updateMany({
        where: { brandId },
        data: { isDefault: false },
      })
    }

    const principles = await prisma.contentCreationPrinciples.create({
      data: {
        brandId,
        workspaceId,
        name,
        systemPrompt,
        isDefault: isDefault ?? false,
      },
    })

    return NextResponse.json({ principles }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create content principles' }, { status: 500 })
  }
}
