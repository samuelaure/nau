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
  getVideoCodec,
} from '@/modules/video/ffmpeg'
import fs from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import https from 'https'
import http from 'http'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Serialize ffmpeg jobs — running them concurrently OOMs the 640MB container.
let optimizationQueue = Promise.resolve()
export function enqueueOptimization(fn: () => Promise<void>): void {
  optimizationQueue = optimizationQueue.then(() => fn().catch(() => {}))
}

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

  enqueueOptimization(() => optimizeAssetBackground({ assetId, cdnUrl, type, mimeType, ext, contextAccountId, templateId, assetFolder }))

  logger.info({ assetId, type }, 'Asset confirmed — optimization queued in background')

  return NextResponse.json({ success: true, asset })
}

async function downloadToTemp(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const file = createWriteStream(destPath)
    proto.get(url, (res) => {
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    }).on('error', (err) => {
      fs.unlink(destPath).catch(() => {})
      reject(err)
    })
  })
}

export async function optimizeAssetBackground(args: {
  assetId: string
  cdnUrl: string
  type: 'VID' | 'AUD' | 'IMG'
  mimeType: string
  ext: string
  contextAccountId: string | null
  templateId: string | null
  assetFolder: 'videos' | 'audios' | 'images'
}) {
  const { assetId, cdnUrl, type, mimeType, ext, contextAccountId, templateId, assetFolder } = args
  const inputPath = getTempPath(`raw_${assetId}.${ext}`)

  await prisma.asset.update({ where: { id: assetId }, data: { optimizationStatus: 'processing' } })

  try {
    await downloadToTemp(cdnUrl, inputPath)
    const inputStats = await fs.stat(inputPath)

    let outputPath = inputPath
    let finalExt = ext
    let finalMime = mimeType
    let thumbPath: string | null = null

    if (type === 'VID') {
      finalExt = 'mp4'
      finalMime = 'video/mp4'
      outputPath = getTempPath(`opt_${assetId}.mp4`)
      await compressVideo(inputPath, outputPath)
      const outStats = await fs.stat(outputPath)
      const sourceCodec = await getVideoCodec(inputPath)
      // Always use transcoded H.264 output when source is not h264 (e.g. vp9).
      // Non-h264 videos crash Remotion's proxy when rendering.
      const mustTranscode = sourceCodec !== null && sourceCodec !== 'h264'
      if (!mustTranscode && outStats.size > inputStats.size) {
        await fs.unlink(outputPath).catch(() => {})
        outputPath = inputPath
        finalExt = ext
        finalMime = mimeType
      }
      thumbPath = getTempPath(`thumb_${assetId}.jpg`)
      try { await generateThumbnail(outputPath, thumbPath) } catch { thumbPath = null }
    } else if (type === 'AUD') {
      finalExt = 'm4a'
      finalMime = 'audio/mp4'
      outputPath = getTempPath(`opt_${assetId}.m4a`)
      await compressAudio(inputPath, outputPath)
      const outStats = await fs.stat(outputPath)
      if (outStats.size > inputStats.size) {
        await fs.unlink(outputPath).catch(() => {})
        outputPath = inputPath
        finalExt = ext
        finalMime = mimeType
      }
    } else if (type === 'IMG') {
      finalExt = 'jpg'
      finalMime = 'image/jpeg'
      outputPath = getTempPath(`opt_${assetId}.jpg`)
      await compressImage(inputPath, outputPath)
      const outStats = await fs.stat(outputPath)
      if (outStats.size > inputStats.size) {
        await fs.unlink(outputPath).catch(() => {})
        outputPath = inputPath
        finalExt = ext
        finalMime = mimeType
      }
    }

    const optimizedR2Key = contextAccountId
      ? flownau.accountAsset(contextAccountId, assetFolder, assetId, finalExt)
      : flownau.templateAsset(templateId || 'global', assetId, finalExt)

    const optimizedStats = await fs.stat(outputPath)
    logger.info({ assetId, r2Key: optimizedR2Key, size: optimizedStats.size }, 'Uploading optimized asset')

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
        optimizationStatus: 'done',
        ...(duration !== undefined && { duration }),
      },
    })

    logger.info({ assetId }, 'Background optimization complete')
  } catch (err) {
    logger.error({ assetId, err }, 'Background optimization failed')
    await prisma.asset.update({ where: { id: assetId }, data: { optimizationStatus: 'failed' } }).catch(() => {})
  } finally {
    await fs.unlink(inputPath).catch(() => {})
  }
}
