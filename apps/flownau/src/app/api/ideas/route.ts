export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkAccountAccess } from '@/modules/shared/actions'

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
