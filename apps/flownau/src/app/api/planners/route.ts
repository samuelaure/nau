export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')
    if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })

    const planners = await prisma.contentPlanner.findMany({
      where: { accountId },
      orderBy: { isDefault: 'desc' },
    })

    return NextResponse.json({ planners }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch planners' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { accountId, name, ...rest } = body

    if (!accountId || !name) {
      return NextResponse.json({ error: 'Missing accountId or name' }, { status: 400 })
    }

    if (rest.isDefault) {
      await prisma.contentPlanner.updateMany({
        where: { accountId },
        data: { isDefault: false },
      })
    }

    const planner = await prisma.contentPlanner.create({
      data: { accountId, name, ...rest },
    })

    return NextResponse.json({ planner }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create planner' }, { status: 500 })
  }
}
