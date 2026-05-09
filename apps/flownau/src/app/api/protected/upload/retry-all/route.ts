export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/lib/logger'
import { enqueueOptimization } from '@/modules/asset/optimization-queue'

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })

  const assets = await prisma.asset.findMany({
    where: { brandId, optimizationStatus: { not: 'done' } },
  })

  if (assets.length === 0) return NextResponse.json({ queued: 0 })

  await prisma.asset.updateMany({
    where: { id: { in: assets.map((a) => a.id) } },
    data: { optimizationStatus: 'pending' },
  })

  for (const asset of assets) {
    const type = asset.type as 'VID' | 'AUD' | 'IMG'
    const ext = asset.systemFilename.split('.').pop() || ''
    const assetFolder =
      type === 'VID' ? ('videos' as const) : type === 'AUD' ? ('audios' as const) : ('images' as const)

    await enqueueOptimization({
      assetId: asset.id,
      cdnUrl: asset.url,
      type,
      mimeType: asset.mimeType,
      ext,
      contextAccountId: asset.brandId,
      templateId: asset.templateId,
      assetFolder,
    })
  }

  logger.info({ brandId, count: assets.length }, 'Bulk asset optimization queued')
  return NextResponse.json({ queued: assets.length })
}
