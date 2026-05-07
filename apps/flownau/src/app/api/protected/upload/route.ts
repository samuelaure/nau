import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { flownau } from 'nau-storage'
import {
  compressVideo,
  compressAudio,
  compressImage,
  getTempPath,
  generateThumbnail,
  getDuration,
} from '@/modules/video/ffmpeg'
import fs from 'fs/promises'
import { createReadStream } from 'fs'

import { createId } from '@paralleldrive/cuid2'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  logger.info('Starting upload processing...')
  // 1. Parse FormData
  const formData = await req.formData()
  const file = formData.get('file') as File
  const brandId = formData.get('brandId') as string | null
  const templateId = formData.get('templateId') as string | null
  const clientHash = formData.get('hash') as string

  if (!file || (!brandId && !templateId)) {
    return NextResponse.json(
      { error: 'Missing file or context (brandId/templateId)' },
      { status: 400 },
    )
  }

  // Generate a pre-determined DB ID for the asset
  const assetId = createId()

  // 2. Determine Context
  let contextAccountId: string | null = brandId

  if (templateId) {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    })

    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    contextAccountId = template.brandId ?? null
  } else if (brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  // 3. Duplicate Detection (content-hash, context-scoped)
  if (clientHash) {
    const duplicate = await prisma.asset.findFirst({
      where: {
        hash: clientHash,
        ...(contextAccountId ? { brandId: contextAccountId } : {}),
        ...(templateId ? { templateId } : {}),
      },
    })

    if (duplicate) {
      return NextResponse.json(
        {
          error: 'DUPLICATE',
          existing: duplicate,
          message: `This file already exists as "${duplicate.systemFilename}"`,
        },
        { status: 409 },
      )
    }
  }

  // 4. Determine Type
  let type: 'VID' | 'AUD' | 'IMG' = 'IMG'
  if (file.type.startsWith('video/')) type = 'VID'
  else if (file.type.startsWith('audio/')) type = 'AUD'
  else if (file.type.startsWith('image/')) type = 'IMG'
  else return NextResponse.json({ error: 'Unsupported type' }, { status: 400 })

  // 5. Save to Temp
  const inputPath = getTempPath(file.name)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(inputPath, buffer)
  logger.debug({ inputPath }, 'Saved temp file')

  const assetFolder =
    type === 'VID' ? ('videos' as const) : type === 'AUD' ? ('audios' as const) : ('images' as const)
  const rawExt = file.name.split('.').pop() || ''
  const rawR2Key = contextAccountId
    ? flownau.accountAsset(contextAccountId, assetFolder, assetId, rawExt)
    : flownau.templateAsset(templateId || 'global', assetId, rawExt)

  try {
    // 6. Upload raw file to R2 immediately so the client isn't blocked on ffmpeg
    const rawStats = await fs.stat(inputPath)
    logger.info({ r2Key: rawR2Key, size: rawStats.size }, 'Uploading raw asset to R2')
    const rawUrl = await storage.upload(rawR2Key, createReadStream(inputPath), {
      mimeType: file.type,
      size: rawStats.size,
    })

    // 7. Create DB record with raw values so the client gets a usable asset immediately
    const systemFilename = `${assetId}.${rawExt}`
    const asset = await prisma.asset.create({
      data: {
        id: assetId,
        brandId: contextAccountId,
        templateId: templateId || null,
        originalFilename: file.name,
        systemFilename,
        r2Key: rawR2Key,
        size: rawStats.size,
        mimeType: file.type,
        hash: clientHash,
        type,
        url: rawUrl,
        thumbnailUrl: null,
        duration: null,
      },
    })

    // 8. Optimize in the background — compress, re-upload, update DB record
    void optimizeAssetBackground({
      assetId,
      inputPath,
      type,
      originalMime: file.type,
      originalExt: rawExt,
      contextAccountId,
      templateId: templateId ?? null,
      assetFolder,
    })

    return NextResponse.json({ success: true, asset })
  } catch (error: unknown) {
    logger.error({ err: (error as Error).message }, 'Upload processing failed')
    await fs.unlink(inputPath).catch(() => {})
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

async function optimizeAssetBackground(args: {
  assetId: string
  inputPath: string
  type: 'VID' | 'AUD' | 'IMG'
  originalMime: string
  originalExt: string
  contextAccountId: string | null
  templateId: string | null
  assetFolder: 'videos' | 'audios' | 'images'
}) {
  const { assetId, inputPath, type, originalMime, originalExt, contextAccountId, templateId, assetFolder } = args

  try {
    const inputStats = await fs.stat(inputPath)
    let outputPath = inputPath
    let finalExt = originalExt
    let finalMime = originalMime
    let thumbPath: string | null = null

    if (type === 'VID') {
      finalExt = 'mp4'
      finalMime = 'video/mp4'
      outputPath = getTempPath(`optimized_${Date.now()}.mp4`)
      await compressVideo(inputPath, outputPath)
      const outputStats = await fs.stat(outputPath)
      if (outputStats.size > inputStats.size) {
        await fs.unlink(outputPath).catch(() => {})
        outputPath = inputPath
        finalExt = originalExt
        finalMime = originalMime
      }
      thumbPath = getTempPath(`thumb_${Date.now()}.jpg`)
      try {
        await generateThumbnail(outputPath, thumbPath)
      } catch {
        thumbPath = null
      }
    } else if (type === 'AUD') {
      finalExt = 'm4a'
      finalMime = 'audio/mp4'
      outputPath = getTempPath(`optimized_${Date.now()}.m4a`)
      await compressAudio(inputPath, outputPath)
      const outputStats = await fs.stat(outputPath)
      if (outputStats.size > inputStats.size) {
        await fs.unlink(outputPath).catch(() => {})
        outputPath = inputPath
        finalExt = originalExt
        finalMime = originalMime
      }
    } else if (type === 'IMG') {
      finalExt = 'jpg'
      finalMime = 'image/jpeg'
      outputPath = getTempPath(`optimized_${Date.now()}.jpg`)
      await compressImage(inputPath, outputPath)
      const outputStats = await fs.stat(outputPath)
      if (outputStats.size > inputStats.size) {
        await fs.unlink(outputPath).catch(() => {})
        outputPath = inputPath
        finalExt = originalExt
        finalMime = originalMime
      }
    }

    const optimizedR2Key = contextAccountId
      ? flownau.accountAsset(contextAccountId, assetFolder, assetId, finalExt)
      : flownau.templateAsset(templateId || 'global', assetId, finalExt)

    const optimizedStats = await fs.stat(outputPath)
    logger.info({ assetId, r2Key: optimizedR2Key, size: optimizedStats.size }, 'Uploading optimized asset to R2')

    const optimizedUrl = await storage.upload(optimizedR2Key, createReadStream(outputPath), {
      mimeType: finalMime,
      size: optimizedStats.size,
    })

    let thumbnailUrl: string | null = null
    if (thumbPath) {
      const thumbKey = contextAccountId
        ? flownau.accountThumbnail(contextAccountId, assetId)
        : flownau.templateThumbnail(templateId || 'global', assetId)
      const thumbStats = await fs.stat(thumbPath)
      thumbnailUrl = await storage.upload(thumbKey, createReadStream(thumbPath), {
        mimeType: 'image/jpeg',
        size: thumbStats.size,
      })
    }

    let duration: number | undefined
    if (type === 'VID' || type === 'AUD') {
      try { duration = await getDuration(outputPath) } catch { /* non-critical */ }
    }

    await prisma.asset.update({
      where: { id: assetId },
      data: {
        r2Key: optimizedR2Key,
        systemFilename: `${assetId}.${finalExt}`,
        size: optimizedStats.size,
        mimeType: finalMime,
        url: optimizedUrl,
        thumbnailUrl,
        ...(duration !== undefined && { duration }),
      },
    })

    logger.info({ assetId }, 'Background optimization complete')
  } catch (err) {
    logger.error({ assetId, err }, 'Background optimization failed')
  } finally {
    await fs.unlink(inputPath).catch(() => {})
  }
}
