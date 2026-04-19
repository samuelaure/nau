export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')
    if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })

    const principles = await prisma.contentCreationPrinciples.findMany({
      where: { accountId },
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
    const { accountId, name, systemPrompt, isDefault } = body

    if (!accountId || !name || !systemPrompt) {
      return NextResponse.json(
        { error: 'Missing accountId, name, or systemPrompt' },
        { status: 400 },
      )
    }

    if (isDefault) {
      await prisma.contentCreationPrinciples.updateMany({
        where: { accountId },
        data: { isDefault: false },
      })
    }

    const principles = await prisma.contentCreationPrinciples.create({
      data: { accountId, name, systemPrompt, isDefault: isDefault ?? false },
    })

    return NextResponse.json({ principles }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create content principles' }, { status: 500 })
  }
}
