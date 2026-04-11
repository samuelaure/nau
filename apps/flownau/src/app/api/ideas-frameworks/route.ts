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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch frameworks' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (body.isDefault && body.accountId) {
      await prisma.ideasFramework.updateMany({
        where: { accountId: body.accountId },
        data: { isDefault: false },
      })
    }

    const framework = await prisma.ideasFramework.create({
      data: {
        accountId: body.accountId,
        name: body.name,
        systemPrompt: body.systemPrompt,
        isDefault: body.isDefault ?? false,
      },
    })
    return NextResponse.json({ framework }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create framework' }, { status: 500 })
  }
}
