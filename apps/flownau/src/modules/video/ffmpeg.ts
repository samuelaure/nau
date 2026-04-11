import ffmpeg from 'fluent-ffmpeg'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { logger } from '@/lib/logger'

// Helper to determine temp file paths
export function getTempPath(filename: string) {
  return path.join(os.tmpdir(), `flownau_${Date.now()}_${filename}`)
}

// Set custom paths if env vars exist (optional)
const isWin = process.platform === 'win32'
const envFfmpeg = isWin
  ? process.env.FFMPEG_PATH_WIN || process.env.FFMPEG_PATH
  : process.env.FFMPEG_PATH
const envFfprobe = isWin
  ? process.env.FFPROBE_PATH_WIN || process.env.FFPROBE_PATH
  : process.env.FFPROBE_PATH

// Only apply custom paths if they actually exist on the current filesystem
if (envFfmpeg && fs.existsSync(envFfmpeg)) {
  logger.info({ path: envFfmpeg }, 'Setting custom FFMPEG path')
  ffmpeg.setFfmpegPath(envFfmpeg)
}

if (envFfprobe && fs.existsSync(envFfprobe)) {
  logger.info({ path: envFfprobe }, 'Setting custom FFPROBE path')
  ffmpeg.setFfprobePath(envFfprobe)
}

/**
 * Compresses a video file.
 * Ensures dimensions fit within 1080x1920 (portrait) or 1920x1080 (landscape)
 * depending on original orientation.
 */
export function compressVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-crf 22',
        '-preset medium',
        '-c:a aac',
        '-b:a 128k',
        '-pix_fmt yuv420p',
      ])
      .videoFilters([
        // If width > height (landscape), target 1920x1080. Otherwise (portrait/square), target 1080x1920.
        "scale='if(gt(iw,ih),min(1920,iw),min(1080,iw))':'if(gt(iw,ih),min(1080,ih),min(1920,ih))':force_original_aspect_ratio=decrease",
        "pad='ceil(iw/2)*2':'ceil(ih/2)*2'", // Ensures dimensions are even
      ])
      .on('start', (commandLine) => {
        logger.debug({ commandLine }, 'Spawned FFmpeg (video)')
      })
      .on('error', (err) => {
        logger.error({ err }, 'Video compression error')
        reject(err)
      })
      .on('end', () => {
        logger.info('Video compression finished')
        resolve()
      })
      .save(outputPath)
  })
}

/**
 * Compresses an image file using ffmpeg.
 * Resizes to fit 1080x1920 and optimizes quality.
 */
export function compressImage(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vframes 1',
        '-q:v 2', // High quality for JPEG (1-31, lower is better)
      ])
      .videoFilters([
        "scale='if(gt(iw,ih),min(1920,iw),min(1080,iw))':'if(gt(iw,ih),min(1080,ih),min(1920,ih))':force_original_aspect_ratio=decrease",
      ])
      .on('error', (err) => {
        logger.error({ err }, 'Image compression error')
        reject(err)
      })
      .on('end', () => {
        logger.info('Image compression finished')
        resolve()
      })
      .save(outputPath)
  })
}

/**
 * Compresses an audio file to AAC, 128k.
 */
export function compressAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-c:a aac', '-b:a 128k'])
      .on('start', (commandLine) => {
        logger.debug({ commandLine }, 'Spawned FFmpeg (audio)')
      })
      .on('error', (err) => {
        logger.error({ err }, 'Audio compression error')
        reject(err)
      })
      .on('end', () => {
        logger.info('Audio compression finished')
        resolve()
      })
      .save(outputPath)
  })
}

/**
 * Generates a thumbnail image from a video at 1s mark.
 */
export function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [1],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1280x?',
      })
      .on('end', () => {
        logger.info('Thumbnail generated')
        resolve()
      })
      .on('error', (err) => {
        logger.error({ err }, 'Thumbnail generation error')
        reject(err)
      })
  })
}

/**
 * Extracts the duration (in seconds) of a media file via ffprobe.
 */
export function getDuration(inputPath: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        logger.error({ err }, 'Error reading media duration')
        resolve(undefined)
      } else {
        resolve(metadata.format.duration)
      }
    })
  })
}
