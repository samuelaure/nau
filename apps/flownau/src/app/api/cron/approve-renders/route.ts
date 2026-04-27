import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'
import { logger } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!validateCronSecret(request)) return unauthorizedCronResponse()

  try {
    const body = await request.json().catch(() => ({}))
    const specificIds: string[] | undefined = body.postIds

    const where = specificIds?.length
      ? { id: { in: specificIds }, status: 'RENDERED_PENDING' }
      : {
          status: 'RENDERED_PENDING',
          scheduledAt: { lte: new Date(Date.now() + 48 * 60 * 60 * 1000) },
        }

    const { count } = await prisma.post.updateMany({ where, data: { status: 'RENDERED_APPROVED' } })

    logger.info(`[ApproveRenders] Approved ${count} post(s) for publishing`)
    return NextResponse.json({ message: 'Approve renders complete', approved: count })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Approve renders failed', details: msg }, { status: 500 })
  }
}
