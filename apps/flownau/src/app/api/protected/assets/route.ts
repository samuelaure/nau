export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

/**
 * GET /api/protected/assets?brandId=X
 * Lightweight poll endpoint — returns optimizationStatus + thumbnailUrl for all
 * brand assets so the UI can reflect live optimization progress.
 */
export async function GET(req: NextRequest) {
  const brandId = new URL(req.url).searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })

  const assets = await prisma.asset.findMany({
    where: { brandId },
    select: {
      id: true,
      url: true,
      r2Key: true,
      systemFilename: true,
      originalFilename: true,
      type: true,
      size: true,
      mimeType: true,
      thumbnailUrl: true,
      duration: true,
      description: true,
      optimizationStatus: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 48,
  })

  return NextResponse.json({ assets })
}
