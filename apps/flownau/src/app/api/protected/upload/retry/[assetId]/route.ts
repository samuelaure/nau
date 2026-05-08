export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { flownau } from 'nau-storage'
import { logger } from '@/lib/logger'
import { enqueueOptimization, optimizeAssetBackground } from '../../confirm/route'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params

  const asset = await prisma.asset.findUnique({ where: { id: assetId } })
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  if (asset.optimizationStatus === 'done') {
    return NextResponse.json({ message: 'Already optimized' }, { status: 200 })
  }

  // Reset to pending so the UI reflects it's queued again
  await prisma.asset.update({ where: { id: assetId }, data: { optimizationStatus: 'pending' } })

  const type = asset.type as 'VID' | 'AUD' | 'IMG'
  const ext = asset.systemFilename.split('.').pop() || ''
  const assetFolder =
    type === 'VID' ? ('videos' as const) : type === 'AUD' ? ('audios' as const) : ('images' as const)

  enqueueOptimization(() =>
    optimizeAssetBackground({
      assetId,
      cdnUrl: asset.url,
      type,
      mimeType: asset.mimeType,
      ext,
      contextAccountId: asset.brandId,
      templateId: asset.templateId,
      assetFolder,
    }),
  )

  logger.info({ assetId }, 'Asset optimization re-queued')
  return NextResponse.json({ success: true })
}
