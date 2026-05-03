import fs from 'fs'
import os from 'os'
import path from 'path'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { logger, logError } from '@/modules/shared/logger'
import { compressVideoForArchive } from '@/modules/video/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'

async function downloadToTemp(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(destPath, buffer)
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
}

function compressJpegForArchive(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-vframes 1', '-q:v 10'])
      .on('error', reject)
      .on('end', resolve)
      .save(outputPath)
  })
}

export async function compressPublishedPost(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { brandId: true, format: true, videoUrl: true, coverUrl: true },
  })
  if (!post) return

  const isVideoFormat = post.format === 'reel' || post.format === 'trial_reel' || post.format === 'head_talk'
  if (!isVideoFormat || !post.videoUrl) return

  const tmpIn = path.join(os.tmpdir(), `flownau_archive_in_${postId}.mp4`)
  const tmpOut = path.join(os.tmpdir(), `flownau_archive_out_${postId}.mp4`)

  try {
    logger.info({ postId, format: post.format }, '[PostCompress] Starting post-publish compression')

    await downloadToTemp(post.videoUrl, tmpIn)
    const sizeBefore = fs.statSync(tmpIn).size
    await compressVideoForArchive(tmpIn, tmpOut)
    const sizeAfter = fs.statSync(tmpOut).size
    const saving = Math.round((1 - sizeAfter / sizeBefore) * 100)

    const r2Key = storage.keyFromCdnUrl(post.videoUrl)
    if (!r2Key) throw new Error(`Cannot derive R2 key from videoUrl: ${post.videoUrl}`)

    await storage.upload(r2Key, fs.createReadStream(tmpOut), { mimeType: 'video/mp4' })
    logger.info({ postId, sizeBefore, sizeAfter, saving: `${saving}%` }, '[PostCompress] Video compressed and re-uploaded')
  } catch (err) {
    logError('[PostCompress] Video compression failed', err)
  } finally {
    cleanupFile(tmpIn)
    cleanupFile(tmpOut)
  }

  if (post.coverUrl) {
    const coverIn = path.join(os.tmpdir(), `flownau_archive_cover_in_${postId}.jpg`)
    const coverOut = path.join(os.tmpdir(), `flownau_archive_cover_out_${postId}.jpg`)
    try {
      await downloadToTemp(post.coverUrl, coverIn)
      await compressJpegForArchive(coverIn, coverOut)
      const coverKey = storage.keyFromCdnUrl(post.coverUrl)
      if (coverKey) {
        await storage.upload(coverKey, fs.createReadStream(coverOut), { mimeType: 'image/jpeg' })
        logger.info({ postId }, '[PostCompress] Cover JPEG compressed and re-uploaded')
      }
    } catch (err) {
      logError('[PostCompress] Cover compression failed', err)
    } finally {
      cleanupFile(coverIn)
      cleanupFile(coverOut)
    }
  }
}
