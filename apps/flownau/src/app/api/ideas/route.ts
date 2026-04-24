export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkAccountAccess } from '@/modules/shared/actions'
import { resolveProvenance } from '@/modules/ideation/provenance'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
    }

    await checkAccountAccess(accountId)

    const ideas = await prisma.contentIdea.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ideas }, { status: 200 })
  } catch (error) {
    console.error('[GET_IDEAS_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch ideas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { accountId, ideaText, source, status, format } = body

    if (!accountId || !ideaText) {
      return NextResponse.json({ error: 'Missing accountId or ideaText' }, { status: 400 })
    }

    await checkAccountAccess(accountId)

    let priority = 3
    if (source === 'captured') priority = 1
    if (source === 'manual') priority = 2

    const provenance = await resolveProvenance(accountId)

    const idea = await prisma.contentIdea.create({
      data: {
        accountId,
        ideaText,
        format: format ?? null,
        source: source || 'manual',
        status: status || 'PENDING',
        priority,
        brandPersonaId: provenance.brandPersonaId,
        ideasFrameworkId: provenance.ideasFrameworkId,
        contentPrinciplesId: provenance.contentPrinciplesId,
      },
    })

    return NextResponse.json({ idea }, { status: 201 })
  } catch (error) {
    console.error('[POST_IDEAS_ERROR]', error)
    return NextResponse.json({ error: 'Failed to create idea' }, { status: 500 })
  }
}
