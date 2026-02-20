import ffmpeg from 'fluent-ffmpeg'
import os from 'os'
import path from 'path'
import fs from 'fs'

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
  console.log(`[FFMPEG] Setting custom path: ${envFfmpeg}`)
  ffmpeg.setFfmpegPath(envFfmpeg)
}

if (envFfprobe && fs.existsSync(envFfprobe)) {
  console.log(`[FFPROBE] Setting custom path: ${envFfprobe}`)
  ffmpeg.setFfprobePath(envFfprobe)
}

/**
 * Compresses a video file to H.264, CRF 24, AAC, keeping height <= 1080p.
 * Logic copied from r2-asset-manager.
 */
export function compressVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-crf 24',
        '-preset medium',
        '-c:a aac',
        '-b:a 128k',
        '-pix_fmt yuv420p',
      ])
      .videoFilters([
        "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
        "pad='ceil(iw/2)*2':'ceil(ih/2)*2'", // Ensures dimensions are even
      ])
      .on('start', (commandLine) => {
        console.log('Spawned Ffmpeg (video) with command: ' + commandLine)
      })
      .on('error', (err) => {
        console.error('Video compression error:', err)
        reject(err)
      })
      .on('end', () => {
        console.log('Video compression finished')
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
        console.log('Spawned Ffmpeg (audio) with command: ' + commandLine)
      })
      .on('error', (err) => {
        console.error('Audio compression error:', err)
        reject(err)
      })
      .on('end', () => {
        console.log('Audio compression finished')
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
        console.log('Thumbnail generated')
        resolve()
      })
      .on('error', (err) => {
        console.error('Thumbnail generation error:', err)
        reject(err)
      })
  })
}
