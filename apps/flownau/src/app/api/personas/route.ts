import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request) {
  // Using an optional accountId query param since personas are account-scoped
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')

  try {
    const whereClause = accountId ? { accountId } : {}
    const personas = await prisma.brandPersona.findMany({
      where: whereClause,
    })
    return NextResponse.json({ personas }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // If setting to default, clear others
    if (body.isDefault && body.accountId) {
      await prisma.brandPersona.updateMany({
        where: { accountId: body.accountId },
        data: { isDefault: false },
      })
    }

    const persona = await prisma.brandPersona.create({
      data: {
        accountId: body.accountId,
        name: body.name,
        systemPrompt: body.systemPrompt,
        ideasFrameworkPrompt: body.ideasFrameworkPrompt ?? '',
        isDefault: body.isDefault ?? false,
        autoApproveIdeas: body.autoApproveIdeas ?? false,
        autoApproveCompositions: body.autoApproveCompositions ?? false,
      },
    })
    return NextResponse.json({ persona }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 })
  }
}
