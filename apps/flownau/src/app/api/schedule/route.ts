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

    const schedule = await prisma.postingSchedule.findUnique({
      where: { accountId },
    })

    return NextResponse.json({ schedule }, { status: 200 })
  } catch (error) {
    console.error('[GET_SCHEDULE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const { accountId, frequencyDays } = json

    if (!accountId || typeof frequencyDays !== 'number') {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    await checkAccountAccess(accountId)

    const schedule = await prisma.postingSchedule.upsert({
      where: { accountId },
      update: { frequencyDays },
      create: { accountId, frequencyDays },
    })

    return NextResponse.json({ schedule }, { status: 200 })
  } catch (error) {
    console.error('[POST_SCHEDULE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}
