export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })

  try {
    const frameworks = await prisma.ideasFramework.findMany({
      where: { accountId },
    })
    return NextResponse.json({ frameworks }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch frameworks' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { accountId, brandId, workspaceId, name, systemPrompt, isDefault } = body

    if (!accountId || !brandId || !workspaceId || !name || !systemPrompt) {
      return NextResponse.json(
        { error: 'Missing accountId, brandId, workspaceId, name, or systemPrompt' },
        { status: 400 },
      )
    }

    if (isDefault && accountId) {
      await prisma.ideasFramework.updateMany({
        where: { accountId },
        data: { isDefault: false },
      })
    }

    const framework = await prisma.ideasFramework.create({
      data: {
        accountId,
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
