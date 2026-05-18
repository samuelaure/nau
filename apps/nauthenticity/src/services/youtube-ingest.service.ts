import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import ytdl from '@distube/ytdl-core'
import { YoutubeTranscript } from 'youtube-transcript'
import { transcribeAudio } from './transcription.service'
import { logger } from '../utils/logger'

export class DurationLimitExceededError extends Error {
  constructor(durationSeconds: number) {
    super(`Video duration ${durationSeconds}s exceeds 3600s limit`)
    this.name = 'DurationLimitExceededError'
  }
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
]

export function extractVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export async function fetchYoutubeMetadata(
  videoId: string,
): Promise<{ title: string | null; channelName: string | null; durationSeconds: number | null }> {
  try {
    const info = await ytdl.getBasicInfo(`https://www.youtube.com/watch?v=${videoId}`)
    const details = info.videoDetails
    const durationSeconds = details.lengthSeconds ? parseInt(details.lengthSeconds, 10) : null
    return {
      title: details.title ?? null,
      channelName: details.author?.name ?? null,
      durationSeconds,
    }
  } catch (err) {
    logger.warn({ videoId, err }, 'failed to fetch YouTube metadata')
    return { title: null, channelName: null, durationSeconds: null }
  }
}

export async function fetchTranscriptAutoCaption(videoId: string): Promise<string> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId)
  return segments.map((s) => s.text).join(' ')
}

export async function downloadAudioAndTranscribe(
  videoId: string,
  durationSeconds: number,
): Promise<string> {
  if (durationSeconds > 3600) {
    throw new DurationLimitExceededError(durationSeconds)
  }

  const tmpDir = os.tmpdir()
  const audioPath = path.join(tmpDir, `yt-${videoId}-${Date.now()}.mp3`)

  try {
    await new Promise<void>((resolve, reject) => {
      const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
        quality: 'lowestaudio',
        filter: 'audioonly',
      })
      const file = fs.createWriteStream(audioPath)
      stream.pipe(file)
      file.on('finish', resolve)
      file.on('error', reject)
      stream.on('error', reject)
    })

    const fileSizeBytes = fs.statSync(audioPath).size
    const fileSizeMB = fileSizeBytes / (1024 * 1024)

    if (fileSizeMB <= 25) {
      const result = await transcribeAudio(audioPath)
      return result.text
    }

    // Split into N chunks each under 25MB
    const N = Math.ceil(fileSizeMB / 25)
    const chunkDuration = Math.ceil(durationSeconds / N)
    const chunkPaths: string[] = []

    for (let i = 0; i < N; i++) {
      const chunkPath = path.join(tmpDir, `yt-${videoId}-chunk${i}-${Date.now()}.mp3`)
      const startSeconds = i * chunkDuration
      execSync(
        `ffmpeg -y -i "${audioPath}" -ss ${startSeconds} -t ${chunkDuration} -vn -acodec copy "${chunkPath}" 2>/dev/null`,
      )
      chunkPaths.push(chunkPath)
    }

    const transcripts = await Promise.all(chunkPaths.map((p) => transcribeAudio(p).then((r) => r.text)))

    for (const p of chunkPaths) {
      fs.rmSync(p, { force: true })
    }

    return transcripts.join(' ')
  } finally {
    fs.rmSync(audioPath, { force: true })
  }
}
