export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const planner = await prisma.contentPlanner.findUnique({ where: { id } })
    if (!planner) return NextResponse.json({ error: 'Planner not found' }, { status: 404 })
    return NextResponse.json({ planner }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch planner' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    if (body.isDefault && body.accountId) {
      await prisma.contentPlanner.updateMany({
        where: { accountId: body.accountId, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const planner = await prisma.contentPlanner.update({
      where: { id },
      data: {
        name: body.name,
        isDefault: body.isDefault,
        autoApproveSchedule: body.autoApproveSchedule,
        strategistPrompt: body.strategistPrompt,
        daysToPlan: body.daysToPlan,
        frequencyDays: body.frequencyDays,
        reelsPerDay: body.reelsPerDay,
        trialReelsPerDay: body.trialReelsPerDay,
        postingTimes: body.postingTimes,
        trialPostingTimes: body.trialPostingTimes,
        timezone: body.timezone,
      },
    })

    return NextResponse.json({ planner }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to update planner' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.contentPlanner.delete({ where: { id } })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to delete planner' }, { status: 500 })
  }
}
