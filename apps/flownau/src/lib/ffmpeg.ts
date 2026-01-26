import ffmpeg from 'fluent-ffmpeg'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'

// Helper to determine temp file paths
export function getTempPath(filename: string) {
  return path.join(os.tmpdir(), `flownau_${Date.now()}_${filename}`)
}

/**
 * Compresses a video file to H.264, CRF 24, AAC, keeping height <= 1080p.
 * Logic copied from r2-asset-manager.
 */
export function compressVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Set custom path if env var exists (optional)
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH)
    }

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
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH)
    }

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
