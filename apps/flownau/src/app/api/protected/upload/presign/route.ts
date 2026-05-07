import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { flownau } from 'nau-storage'
import { createId } from '@paralleldrive/cuid2'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { filename, mimeType, size, hash, brandId, templateId } = body as {
    filename: string
    mimeType: string
    size: number
    hash: string
    brandId?: string
    templateId?: string
  }

  if (!filename || !mimeType || !brandId && !templateId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let type: 'VID' | 'AUD' | 'IMG' = 'IMG'
  if (mimeType.startsWith('video/')) type = 'VID'
  else if (mimeType.startsWith('audio/')) type = 'AUD'
  else if (mimeType.startsWith('image/')) type = 'IMG'
  else return NextResponse.json({ error: 'Unsupported type' }, { status: 400 })

  let contextAccountId: string | null = brandId ?? null

  if (templateId) {
    const template = await prisma.template.findUnique({ where: { id: templateId } })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    contextAccountId = template.brandId ?? null
  } else if (brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  if (hash) {
    const duplicate = await prisma.asset.findFirst({
      where: {
        hash,
        ...(contextAccountId ? { brandId: contextAccountId } : {}),
        ...(templateId ? { templateId } : {}),
      },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'DUPLICATE', existing: duplicate, message: `This file already exists as "${duplicate.systemFilename}"` },
        { status: 409 },
      )
    }
  }

  const assetId = createId()
  const ext = filename.split('.').pop() || ''
  const assetFolder =
    type === 'VID' ? ('videos' as const) : type === 'AUD' ? ('audios' as const) : ('images' as const)
  const r2Key = contextAccountId
    ? flownau.accountAsset(contextAccountId, assetFolder, assetId, ext)
    : flownau.templateAsset(templateId || 'global', assetId, ext)

  const { uploadUrl, cdnUrl } = await storage.presignUpload(r2Key, mimeType, 900)

  logger.info({ assetId, r2Key, size }, 'Presigned upload URL issued')

  return NextResponse.json({
    assetId,
    uploadUrl,
    cdnUrl,
    r2Key,
    ext,
    type,
    contextAccountId,
  })
}
