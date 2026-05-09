export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/lib/logger'
import { enqueueOptimization } from '@/modules/asset/optimization-queue'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params

  const asset = await prisma.asset.findUnique({ where: { id: assetId } })
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  if (asset.optimizationStatus === 'done') {
    return NextResponse.json({ message: 'Already optimized' }, { status: 200 })
  }

  await prisma.asset.update({ where: { id: assetId }, data: { optimizationStatus: 'pending' } })

  const type = asset.type as 'VID' | 'AUD' | 'IMG'
  const ext = asset.systemFilename.split('.').pop() || ''
  const assetFolder =
    type === 'VID' ? ('videos' as const) : type === 'AUD' ? ('audios' as const) : ('images' as const)

  await enqueueOptimization({
    assetId,
    cdnUrl: asset.url,
    type,
    mimeType: asset.mimeType,
    ext,
    contextAccountId: asset.brandId,
    templateId: asset.templateId,
    assetFolder,
  })

  logger.info({ assetId }, 'Asset optimization re-queued')
  return NextResponse.json({ success: true })
}
