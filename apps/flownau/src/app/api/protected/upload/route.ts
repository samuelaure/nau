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
  const accountId = formData.get('accountId') as string | null
  const templateId = formData.get('templateId') as string | null
  const clientHash = formData.get('hash') as string

  if (!file || (!accountId && !templateId)) {
    return NextResponse.json(
      { error: 'Missing file or context (accountId/templateId)' },
      { status: 400 },
    )
  }

  // Generate a pre-determined DB ID for the asset
  const assetId = createId()

  // 2. Determine Context
  let contextAccountId: string | null = accountId

  if (templateId) {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: { account: true },
    })

    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    if (template.account) {
      contextAccountId = template.accountId
    } else {
      contextAccountId = null
    }
  } else if (accountId) {
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    // Backfill shortCode if missing
    if (!account.shortCode && account.username) {
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: { shortCode: account.username.substring(0, 2).toUpperCase() },
      })
    }
  }

  // 3. Duplicate Detection (content-hash, context-scoped)
  if (clientHash) {
    const duplicate = await prisma.asset.findFirst({
      where: {
        hash: clientHash,
        ...(contextAccountId ? { accountId: contextAccountId } : {}),
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

  try {
    // 6. Optimize
    let outputPath = inputPath
    let finalExt = file.name.split('.').pop() || ''
    let finalMime = file.type
    let thumbPath: string | null = null

    const inputStats = await fs.stat(inputPath)

    if (type === 'VID') {
      finalExt = 'mp4'
      finalMime = 'video/mp4'
      outputPath = getTempPath(`optimized_${Date.now()}.mp4`)
      await compressVideo(inputPath, outputPath)

      const outputStats = await fs.stat(outputPath)
      if (outputStats.size > inputStats.size) {
        logger.info(
          { outputSize: outputStats.size, inputSize: inputStats.size },
          'Skipping video re-encode: output larger than input',
        )
        await fs.unlink(outputPath).catch(() => {})
        outputPath = inputPath
        finalExt = file.name.split('.').pop() || 'mp4'
        finalMime = file.type || 'video/mp4'
      }

      thumbPath = getTempPath(`thumb_${Date.now()}.jpg`)
      try {
        await generateThumbnail(outputPath, thumbPath)
      } catch (e) {
        logger.warn({ err: e }, 'Thumbnail generation failed, continuing without it')
        thumbPath = null
      }
    } else if (type === 'AUD') {
      finalExt = 'm4a'
      finalMime = 'audio/mp4'
      outputPath = getTempPath(`optimized_${Date.now()}.m4a`)
      await compressAudio(inputPath, outputPath)

      const outputStats = await fs.stat(outputPath)
      if (outputStats.size > inputStats.size) {
        logger.info('Skipping audio re-encode: output larger than input')
        await fs.unlink(outputPath).catch(() => {})
        outputPath = inputPath
        finalExt = file.name.split('.').pop() || 'm4a'
        finalMime = file.type || 'audio/mp4'
      }
    } else if (type === 'IMG') {
      finalExt = 'jpg'
      finalMime = 'image/jpeg'
      outputPath = getTempPath(`optimized_${Date.now()}.jpg`)
      await compressImage(inputPath, outputPath)

      const outputStats = await fs.stat(outputPath)
      if (outputStats.size > inputStats.size) {
        logger.info('Skipping image re-encode: output larger than input')
        await fs.unlink(outputPath).catch(() => {})
        outputPath = inputPath
        finalExt = file.name.split('.').pop() || 'jpg'
        finalMime = file.type || 'image/jpeg'
      }
    }

    // 7. Build R2 key using canonical path builders
    const assetFolder = type === 'VID' ? 'videos' as const : type === 'AUD' ? 'audios' as const : 'images' as const
    const r2Key = contextAccountId
      ? flownau.accountAsset(contextAccountId, assetFolder, assetId, finalExt)
      : flownau.templateAsset(templateId || 'global', assetId, finalExt)

    // 8. Upload to R2
    const fileStream = createReadStream(outputPath)
    const stats = await fs.stat(outputPath)

    logger.info({ r2Key, size: stats.size }, 'Uploading asset to R2')

    const publicUrl = await storage.upload(r2Key, fileStream, {
      mimeType: finalMime,
      size: stats.size,
    })

    // Upload thumbnail if generated
    let thumbnailUrl: string | null = null
    if (thumbPath) {
      const thumbKey = contextAccountId
        ? flownau.accountThumbnail(contextAccountId, assetId)
        : flownau.templateThumbnail(templateId || 'global', assetId)
      const thumbStream = createReadStream(thumbPath)
      const thumbStats = await fs.stat(thumbPath)

      thumbnailUrl = await storage.upload(thumbKey, thumbStream, {
        mimeType: 'image/jpeg',
        size: thumbStats.size,
      })
    }

    // 9. Get Duration if applicable
    let duration: number | undefined = undefined
    if (type === 'VID' || type === 'AUD') {
      try {
        duration = await getDuration(outputPath)
      } catch (e) {
        logger.warn({ err: e }, 'Failed to get media duration')
      }
    }

    // 10. DB Record
    const systemFilename = `${assetId}.${finalExt}`
    const asset = await prisma.asset.create({
      data: {
        id: assetId,
        accountId: contextAccountId,
        templateId: templateId || null,
        originalFilename: file.name,
        systemFilename,
        r2Key,
        size: stats.size,
        mimeType: finalMime,
        hash: clientHash,
        type,
        url: publicUrl,
        thumbnailUrl,
        duration,
      },
    })

    // 11. Cleanup
    await fs.unlink(inputPath).catch((e) => logger.warn({ err: e }, 'Cleanup failed'))
    if (outputPath !== inputPath) {
      await fs.unlink(outputPath).catch((e) => logger.warn({ err: e }, 'Cleanup failed'))
    }
    if (thumbPath) {
      await fs.unlink(thumbPath).catch((e) => logger.warn({ err: e }, 'Cleanup failed'))
    }

    return NextResponse.json({ success: true, asset })
  } catch (error: unknown) {
    logger.error({ err: (error as Error).message }, 'Upload processing failed')
    await fs.unlink(inputPath).catch(() => {})
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
