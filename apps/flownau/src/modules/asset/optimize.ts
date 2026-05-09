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
import type { OptimizationJobData } from './optimization-queue'

function downloadToTemp(url: string, destPath: string): Promise<void> {
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

export async function optimizeAsset(args: OptimizationJobData): Promise<void> {
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
      // Non-h264 source (e.g. vp9) crashes Remotion's proxy — always use transcoded output.
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

    logger.info({ assetId }, 'Asset optimization complete')
  } catch (err) {
    logger.error({ assetId, err }, 'Asset optimization failed')
    await prisma.asset.update({ where: { id: assetId }, data: { optimizationStatus: 'failed' } }).catch(() => {})
  } finally {
    await fs.unlink(inputPath).catch(() => {})
  }
}
