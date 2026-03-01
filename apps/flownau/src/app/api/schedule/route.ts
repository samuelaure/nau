import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
    }

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
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    const { accountId, frequencyDays } = json

    if (!accountId || typeof frequencyDays !== 'number') {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
    })

    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

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
