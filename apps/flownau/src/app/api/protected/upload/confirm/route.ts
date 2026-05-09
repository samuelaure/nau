import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/lib/logger'
import { enqueueOptimization } from '@/modules/asset/optimization-queue'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { assetId, r2Key, cdnUrl, ext, type, contextAccountId, templateId, originalFilename, mimeType, hash, size } = body as {
    assetId: string
    r2Key: string
    cdnUrl: string
    ext: string
    type: 'VID' | 'AUD' | 'IMG'
    contextAccountId: string | null
    templateId: string | null
    originalFilename: string
    mimeType: string
    hash: string
    size: number
  }

  if (!assetId || !r2Key || !cdnUrl || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const systemFilename = `${assetId}.${ext}`
  const asset = await prisma.asset.create({
    data: {
      id: assetId,
      brandId: contextAccountId,
      templateId: templateId || null,
      originalFilename,
      systemFilename,
      r2Key,
      size,
      mimeType,
      hash,
      type,
      url: cdnUrl,
      thumbnailUrl: null,
      duration: null,
      optimizationStatus: 'pending',
    },
  })

  const assetFolder =
    type === 'VID' ? ('videos' as const) : type === 'AUD' ? ('audios' as const) : ('images' as const)

  await enqueueOptimization({ assetId, cdnUrl, type, mimeType, ext, contextAccountId, templateId, assetFolder })

  logger.info({ assetId, type }, 'Asset confirmed — optimization enqueued')

  return NextResponse.json({ success: true, asset })
}
