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

    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
    })

    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const compositions = await prisma.composition.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json({ compositions }, { status: 200 })
  } catch (error) {
    console.error('[GET_COMPOSITIONS_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch compositions' }, { status: 500 })
  }
}
