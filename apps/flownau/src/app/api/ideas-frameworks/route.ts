export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })

  try {
    const frameworks = await prisma.ideasFramework.findMany({
      where: { brandId },
    })
    return NextResponse.json({ frameworks }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch frameworks' }, { status: 500 })
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

    if (isDefault && brandId) {
      await prisma.ideasFramework.updateMany({
        where: { brandId },
        data: { isDefault: false },
      })
    }

    const framework = await prisma.ideasFramework.create({
      data: {
        brandId,
        workspaceId,
        name,
        systemPrompt,
        isDefault: isDefault ?? false,
      },
    })
    return NextResponse.json({ framework }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create framework' }, { status: 500 })
  }
}
