import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { flownau } from 'nau-storage'
import { createId } from '@paralleldrive/cuid2'
import { enqueueOptimization } from '@/modules/asset/optimization-queue'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const mami = await prisma.brand.findFirst({ where: { name: 'Mami Abundancia' } })
    const andi = await prisma.brand.findFirst({ where: { name: 'Andi Universo' } })

    if (!mami || !andi) {
      return NextResponse.json({ error: 'Brands not found' }, { status: 404 })
    }

    const assets = await prisma.asset.findMany({
      where: { brandId: mami.id, type: 'VID' }
    })

    const results = []

    for (const asset of assets) {
      if (!asset.hash) continue

      const existing = await prisma.asset.findFirst({
        where: { brandId: andi.id, hash: asset.hash }
      })

      if (existing) {
        results.push({ systemFilename: asset.systemFilename, status: 'skipped (exists)' })
        continue
      }

      // 1. Download buffer
      const res = await fetch(asset.url)
      if (!res.ok) {
        results.push({ systemFilename: asset.systemFilename, status: 'failed to download' })
        continue
      }
      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 2. Generate new keys
      const assetId = createId()
      const ext = asset.systemFilename.split('.').pop() || 'mp4'
      const r2Key = flownau.accountAsset(andi.id, 'videos', assetId, ext)
      const systemFilename = `${assetId}.${ext}`

      // 3. Upload to R2
      const url = await storage.upload(r2Key, buffer, { mimeType: asset.mimeType, size: buffer.length })

      // 4. Save to DB
      await prisma.asset.create({
        data: {
          id: assetId,
          brandId: andi.id,
          templateId: null,
          originalFilename: asset.originalFilename,
          systemFilename,
          r2Key,
          size: buffer.length,
          mimeType: asset.mimeType,
          hash: asset.hash,
          type: 'VID',
          url,
          thumbnailUrl: asset.thumbnailUrl,
          duration: asset.duration,
          optimizationStatus: asset.optimizationStatus, // Preserve 'done'
        }
      })

      // 5. If it needs optimization, enqueue it
      if (asset.optimizationStatus === 'pending') {
        await enqueueOptimization({
          assetId,
          cdnUrl: url,
          type: 'VID',
          mimeType: asset.mimeType,
          ext,
          contextAccountId: andi.id,
          templateId: null,
          assetFolder: 'videos'
        })
      }

      results.push({ systemFilename: asset.systemFilename, status: 'copied', newSystemFilename: systemFilename })
      logger.info({ oldFilename: asset.systemFilename, newFilename: systemFilename }, 'Asset migrated')
    }

    return NextResponse.json({ success: true, count: results.filter(r => r.status === 'copied').length, results })
  } catch (error: any) {
    logger.error('Migration failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
