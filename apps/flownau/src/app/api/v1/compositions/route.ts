export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { validateServiceToken, unauthorizedResponse } from '@/modules/shared/nau-auth'
import { prisma } from '@/modules/shared/prisma'
import { logError } from '@/modules/shared/logger'

/**
 * GET /api/v1/compositions — Query compositions by account and status.
 * Called by: Zazŭ (to check rendering/publishing status)
 * Auth: NAU_SERVICE_KEY
 *
 * Query params: brandId (required), status, format, limit
 */
export async function GET(req: Request) {
  if (!(await validateServiceToken(req))) {
    return unauthorizedResponse()
  }

  try {
    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get('brandId')
    const status = searchParams.get('status')
    const format = searchParams.get('format')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

    if (!brandId) {
      return NextResponse.json({ error: 'brandId query param is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { brandId }
    if (status) where.status = status
    if (format) where.format = format

    const compositions = await prisma.composition.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        brandId: true,
        format: true,
        status: true,
        caption: true,
        hashtags: true,
        videoUrl: true,
        coverUrl: true,
        sceneTypes: true,
        scheduledAt: true,
        publishAttempts: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ compositions, count: compositions.length })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch compositions'
    logError('[CompositionsAPI] Query failed', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
