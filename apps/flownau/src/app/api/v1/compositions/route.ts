import { NextResponse } from 'next/server'
import { validateServiceKey, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { prisma } from '@/modules/shared/prisma'

/**
 * GET /api/v1/compositions — Query compositions by account and status.
 * Called by: Zazŭ (to check rendering/publishing status)
 * Auth: NAU_SERVICE_KEY
 *
 * Query params: accountId, status, format, limit
 */
export async function GET(req: Request) {
  if (!validateServiceKey(req)) {
    return unauthorizedResponse()
  }

  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')
    const status = searchParams.get('status')
    const format = searchParams.get('format')
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)

    const where: Record<string, unknown> = {}
    if (accountId) where.accountId = accountId
    if (status) where.status = status
    if (format) where.format = format

    const compositions = await prisma.composition.findMany({
      where,
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        accountId: true,
        format: true,
        status: true,
        caption: true,
        hashtags: true,
        videoUrl: true,
        coverUrl: true,
        scheduledAt: true,
        publishAttempts: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ compositions, count: compositions.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch compositions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
