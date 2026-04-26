export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request) {
  // Using an optional brandId query param since personas are account-scoped
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')

  try {
    const whereClause = brandId ? { brandId } : {}
    const personas = await prisma.brandPersona.findMany({
      where: whereClause,
    })
    return NextResponse.json({ personas }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { brandId, workspaceId, name, systemPrompt, ...rest } = body

    if (!brandId || !brandId || !workspaceId || !name || !systemPrompt) {
      return NextResponse.json(
        { error: 'Missing brandId, workspaceId, name, or systemPrompt' },
        { status: 400 },
      )
    }

    // If setting to default, clear others
    if (rest.isDefault && brandId) {
      await prisma.brandPersona.updateMany({
        where: { brandId },
        data: { isDefault: false },
      })
    }

    const persona = await prisma.brandPersona.create({
      data: {
        brandId,
        workspaceId,
        name,
        systemPrompt,
        modelSelection: rest.modelSelection ?? 'GROQ_LLAMA_3_3',
        isDefault: rest.isDefault ?? false,
        autoApproveIdeas: rest.autoApproveIdeas ?? false,
        autoApproveCompositions: rest.autoApproveCompositions ?? false,
        autoApprovePool: rest.autoApprovePool ?? false,
        capturedCount: rest.capturedCount ?? 3,
        capturedAutoApprove: rest.capturedAutoApprove ?? false,
        manualCount: rest.manualCount ?? 5,
        manualAutoApprove: rest.manualAutoApprove ?? false,
        automaticCount: rest.automaticCount ?? 5,
        automaticAutoApprove: rest.automaticAutoApprove ?? false,
      },
    })
    return NextResponse.json({ persona }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 })
  }
}
