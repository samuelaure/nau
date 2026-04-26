export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })

    const planners = await prisma.contentPlanner.findMany({
      where: { brandId },
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
    const { brandId, workspaceId, name, ...rest } = body

    if (!brandId || !brandId || !workspaceId || !name) {
      return NextResponse.json(
        { error: 'Missing brandId, workspaceId, or name' },
        { status: 400 },
      )
    }

    if (rest.isDefault) {
      await prisma.contentPlanner.updateMany({
        where: { brandId },
        data: { isDefault: false },
      })
    }

    const planner = await prisma.contentPlanner.create({
      data: { brandId, workspaceId, name, ...rest },
    })

    return NextResponse.json({ planner }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create planner' }, { status: 500 })
  }
}
