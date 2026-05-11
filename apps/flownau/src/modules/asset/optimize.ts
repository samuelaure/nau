import { prisma } from '@/modules/shared/prisma'
import { storage, keyFromCdnUrl } from '@/modules/shared/r2'
import { flownau } from 'nau-storage'
import {
  compressVideo,
  compressAudio,
  compressImage,
  getTempPath,
  generateThumbnail,
  getDuration,
  getVideoCodec,
  splitVideo,
} from '@/modules/video/ffmpeg'
import fs from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import https from 'https'
import http from 'http'
import path from 'path'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import type { OptimizationJobData } from './optimization-queue'

const MAX_SEGMENT_SECS = 27

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

interface SplitContext {
  assetId: string
  compressedPath: string
  duration: number
  contextAccountId: string | null
  templateId: string | null
  assetFolder: 'videos' | 'audios' | 'images'
  brandId: string | null
}

export async function splitAndStoreSegments(ctx: SplitContext): Promise<void> {
  const { assetId, compressedPath, duration, contextAccountId, templateId, assetFolder, brandId } = ctx
  const segmentPattern = getTempPath(`split_${assetId}_%03d.mp4`)
  const segmentDir = path.dirname(segmentPattern)
  const segmentBase = path.basename(segmentPattern)

  // Divide into equal parts, each staying under MAX_SEGMENT_SECS.
  const numSegments = Math.ceil(duration / MAX_SEGMENT_SECS)
  const segmentSecs = duration / numSegments
  const segmentCount = await splitVideo(compressedPath, segmentPattern, segmentSecs)

  const segmentPaths: string[] = []
  for (let i = 0; ; i++) {
    const p = path.join(segmentDir, segmentBase.replace('%03d', String(i).padStart(3, '0')))
    try { await fs.access(p); segmentPaths.push(p) } catch { break }
  }

  logger.info({ assetId, segments: segmentPaths.length }, '[split] Uploading segments')

  for (let i = 0; i < segmentPaths.length; i++) {
    const segPath = segmentPaths[i]
    const segId = randomUUID()
    const r2Key = contextAccountId
      ? flownau.accountAsset(contextAccountId, assetFolder, segId, 'mp4')
      : flownau.templateAsset(templateId || 'global', segId, 'mp4')

    const segStats = await fs.stat(segPath)
    const segUrl = await storage.upload(r2Key, createReadStream(segPath), { mimeType: 'video/mp4', size: segStats.size })

    let segDuration: number | undefined
    try { segDuration = await getDuration(segPath) } catch { /* non-critical */ }

    let thumbUrl: string | null = null
    const thumbPath = getTempPath(`thumb_${segId}.jpg`)
    try {
      await generateThumbnail(segPath, thumbPath)
      const thumbKey = contextAccountId
        ? flownau.accountThumbnail(contextAccountId, segId)
        : flownau.templateThumbnail(templateId || 'global', segId)
      const thumbStats = await fs.stat(thumbPath)
      thumbUrl = await storage.upload(thumbKey, createReadStream(thumbPath), { mimeType: 'image/jpeg', size: thumbStats.size })
    } catch { /* thumbnail is non-critical */ } finally {
      await fs.unlink(thumbPath).catch(() => {})
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.asset.create as any)({
      data: {
        id: segId,
        brandId,
        templateId,
        type: 'VID',
        systemFilename: `${segId}.mp4`,
        originalFilename: `${segId}.mp4`,
        r2Key,
        url: segUrl,
        size: segStats.size,
        mimeType: 'video/mp4',
        thumbnailUrl: thumbUrl,
        duration: segDuration,
        optimizationStatus: 'done',
        splitFromId: assetId,
        splitIndex: i,
      },
    })

    logger.info({ assetId, segId, index: i, duration: segDuration }, '[split] Segment stored')
    await fs.unlink(segPath).catch(() => {})
  }

  // Purge the parent's R2 files — segments are the canonical assets now.
  // The DB row is kept with optimizationStatus='purged' so the hash blocks re-uploads.
  const parent = await prisma.asset.findUnique({ where: { id: assetId }, select: { r2Key: true, thumbnailUrl: true } })
  if (parent) {
    const keysToDelete = [parent.r2Key]
    if (parent.thumbnailUrl) {
      const thumbKey = keyFromCdnUrl(parent.thumbnailUrl)
      if (thumbKey && thumbKey !== parent.r2Key) keysToDelete.push(thumbKey)
    }
    await storage.deleteMany(keysToDelete).catch((err) => logger.warn({ assetId, err }, '[split] Failed to purge parent R2 files'))
  }

  await prisma.asset.update({
    where: { id: assetId },
    data: { optimizationStatus: 'purged', r2Key: '', url: '', thumbnailUrl: null },
  })

  logger.info({ assetId, segments: segmentPaths.length }, '[split] Asset split complete — parent purged')
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

    // Split long videos into ≤27s segments instead of storing them as-is.
    if (type === 'VID' && duration !== undefined && duration > MAX_SEGMENT_SECS) {
      const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { brandId: true } })
      await splitAndStoreSegments({
        assetId,
        compressedPath: outputPath,
        duration,
        contextAccountId,
        templateId,
        assetFolder,
        brandId: asset?.brandId ?? null,
      })
      // Original asset is marked 'split' by splitAndStoreSegments — skip the normal update.
      logger.info({ assetId, duration }, '[OptimizeAsset] Video split into segments — skipping normal asset update')
      return
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
