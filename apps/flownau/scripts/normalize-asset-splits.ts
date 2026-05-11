/**
 * One-time script: split all existing VID assets longer than 27s into ≤27s segments.
 *
 * Run (from apps/flownau):
 *   DATABASE_URL=... REDIS_URL=... npx tsx scripts/normalize-asset-splits.ts
 *
 * Safe to re-run: assets already split (optimizationStatus='split') are skipped.
 * Dry-run mode (no writes): pass --dry-run flag.
 */

import { PrismaClient } from '../src/generated/prisma'
import { storage } from '../src/modules/shared/r2'
import { flownau } from 'nau-storage'
import { splitVideo, getDuration, generateThumbnail, getTempPath } from '../src/modules/video/ffmpeg'
import fs from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import https from 'https'
import http from 'http'
import path from 'path'
import { randomUUID } from 'crypto'

const MAX_SEGMENT_SECS = 27
const DRY_RUN = process.argv.includes('--dry-run')

const prisma = new PrismaClient()

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

async function processAsset(asset: {
  id: string
  url: string
  brandId: string | null
  templateId: string | null
  duration: number | null
}) {
  const { id: assetId, url, brandId, templateId } = asset

  const inputPath = getTempPath(`norm_${assetId}.mp4`)
  console.log(`\n[${assetId}] Downloading from ${url}`)
  await downloadToTemp(url, inputPath)

  const duration = await getDuration(inputPath) ?? asset.duration ?? 0
  if (duration <= MAX_SEGMENT_SECS) {
    console.log(`[${assetId}] Duration ${duration.toFixed(1)}s ≤ ${MAX_SEGMENT_SECS}s — skipping`)
    await fs.unlink(inputPath).catch(() => {})
    return
  }

  const segCount = Math.ceil(duration / MAX_SEGMENT_SECS)
  console.log(`[${assetId}] Duration ${duration.toFixed(1)}s → splitting into ${segCount} segments (dry=${DRY_RUN})`)

  if (DRY_RUN) {
    await fs.unlink(inputPath).catch(() => {})
    return
  }

  // Determine context for R2 key construction
  const assetFolder = 'videos' as const
  const contextAccountId = brandId  // accountAsset takes brandId as contextAccountId

  const segmentPattern = getTempPath(`split_${assetId}_%03d.mp4`)
  const segmentDir = path.dirname(segmentPattern)
  const segmentBase = path.basename(segmentPattern)

  await splitVideo(inputPath, segmentPattern, MAX_SEGMENT_SECS)

  // Collect produced files
  const segmentPaths: string[] = []
  for (let i = 0; ; i++) {
    const p = path.join(segmentDir, segmentBase.replace('%03d', String(i).padStart(3, '0')))
    try { await fs.access(p); segmentPaths.push(p) } catch { break }
  }

  console.log(`[${assetId}] ${segmentPaths.length} segment files produced`)

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
    } catch { /* non-critical */ } finally {
      await fs.unlink(thumbPath).catch(() => {})
    }

    await prisma.asset.create({
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

    console.log(`[${assetId}] Segment ${i} stored as ${segId} (${segDuration?.toFixed(1)}s)`)
    await fs.unlink(segPath).catch(() => {})
  }

  await prisma.asset.update({ where: { id: assetId }, data: { optimizationStatus: 'split' } })
  console.log(`[${assetId}] Marked as split`)

  await fs.unlink(inputPath).catch(() => {})
}

async function main() {
  console.log(`normalize-asset-splits — MAX_SEGMENT_SECS=${MAX_SEGMENT_SECS} DRY_RUN=${DRY_RUN}`)

  const assets = await prisma.asset.findMany({
    where: {
      type: 'VID',
      optimizationStatus: 'done',  // skip already-split, pending, failed
      splitFromId: null,           // skip segments themselves
      OR: [
        { duration: { gt: MAX_SEGMENT_SECS } },
        { duration: null },  // duration unknown — will probe during download
      ],
    },
    select: { id: true, url: true, brandId: true, templateId: true, duration: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Found ${assets.length} candidate assets`)

  let processed = 0
  let skipped = 0
  let errors = 0

  for (const asset of assets) {
    try {
      await processAsset(asset)
      processed++
    } catch (err) {
      console.error(`[${asset.id}] ERROR:`, err)
      errors++
    }
  }

  console.log(`\nDone — processed: ${processed}, skipped: ${skipped}, errors: ${errors}`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
