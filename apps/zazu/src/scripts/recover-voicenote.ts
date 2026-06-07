/**
 * One-shot recovery script for the failed voicenote from 2026-06-06.
 *
 * The file is still alive on Telegram's servers. This script downloads it,
 * transcribes it, synthesises cleanTranscription + summary, and inserts the
 * Voicenote row with the ORIGINAL timestamp so it shows up in the correct date.
 *
 * Usage (run inside the container after deployment):
 *   node apps/zazu/dist/scripts/recover-voicenote.js
 *
 * Or locally (from nau root):
 *   dotenv -e .env.development -- npx ts-node --project apps/zazu/tsconfig.json apps/zazu/src/scripts/recover-voicenote.ts
 */

import * as dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import axios from 'axios'
import fs from 'fs'
import os from 'os'
import { z } from 'zod'
import prisma from '@zazu/db'
import { getStorage } from '../lib/storage'
import { getClientForFeature, getFeatureFallbackChain } from '@nau/llm-client'
import { logger } from '../lib/logger'

// ── Constants from the failed event log ──────────────────────────────────────
const FAILED_FILE_ID = 'AwACAgQAAxkBAAIGvGokiY63AvCyeczaVhdTisvrj80oAAJtLQAChPspUVb3mJng8ZjsOwQ'
// Unix ms timestamp from the error log: 1780779437914 = 2026-06-06T10:57:17.914Z
const ORIGINAL_TIMESTAMP = new Date(1780779437914)

async function main() {
  logger.info('Starting voicenote recovery...')

  // 1. Resolve your Zazŭ user id from the DB (you're the only user with nauUserId set)
  const user = await prisma.user.findFirst({
    where: { nauUserId: { not: null } },
    orderBy: { createdAt: 'asc' },
  })
  if (!user) throw new Error('No linked Zazŭ user found in DB')
  logger.info({ userId: user.id, telegramId: user.telegramId.toString() }, 'Found user')

  // 2. Download the audio from Telegram
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')

  logger.info({ fileId: FAILED_FILE_ID }, 'Fetching file info from Telegram...')
  const fileInfoResp = await axios.get(`https://api.telegram.org/bot${token}/getFile`, {
    params: { file_id: FAILED_FILE_ID },
    timeout: 15_000,
  })
  const filePath: string = fileInfoResp.data.result.file_path
  const fileSize: number = fileInfoResp.data.result.file_size
  logger.info({ filePath, fileSize }, 'Got file info')

  const telegramFileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`
  logger.info('Downloading audio buffer...')
  const audioResp = await axios.get(telegramFileUrl, { responseType: 'arraybuffer', timeout: 120_000 })
  const audioBuffer = Buffer.from(audioResp.data)
  logger.info({ bytes: audioBuffer.length }, 'Audio downloaded')

  // 3. Upload to R2 storage under a recovery prefix
  const storage = getStorage()
  const storageKey = `zazu/voicenotes/recovery/${user.telegramId}/${FAILED_FILE_ID.slice(0, 16)}.ogg`
  const audioUrl = await storage.upload(storageKey, audioBuffer, { mimeType: 'audio/ogg' })
  logger.info({ audioUrl }, 'Uploaded to R2')

  // 4. Write to tmp and transcribe
  const tmpPath = path.join(os.tmpdir(), `nau-voice-recovery-${Date.now()}.ogg`)
  fs.writeFileSync(tmpPath, audioBuffer)
  logger.info('Transcribing...')

  let rawTranscription = ''
  try {
    const chain = getFeatureFallbackChain('transcription')
    let lastError: unknown
    for (const { client, model } of chain) {
      try {
        const result = await client.transcribe({ model, file: fs.createReadStream(tmpPath) })
        rawTranscription = result.text
        logger.info({ model, chars: rawTranscription.length }, 'Transcription complete')
        break
      } catch (err) {
        lastError = err
        logger.warn({ err, model }, 'Transcription attempt failed, trying next in chain')
      }
    }
    if (!rawTranscription) throw lastError
  } finally {
    fs.rmSync(tmpPath, { force: true })
  }

  // 5. Synthesise
  logger.info('Synthesising clean transcription + summary...')
  const { client: synthClient, model: synthModel } = getClientForFeature('synthesis')
  const synthResult = await synthClient.chatCompletion({
    model: synthModel,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `You receive a raw voice transcription. Return JSON with two fields:
- "cleanTranscription": the transcription cleaned of filler words, repeated phrases, and disfluencies, with proper punctuation. Keep all meaning intact. Write in the same language as the input.
- "summary": a condensed re-narration of the voice note in the same language, person (first-person if the speaker uses it), and perspective as the original. Do NOT interpret, explain, or add context. Just faithfully compress the content into 2-4 sentences that capture all key points. Imagine the speaker re-reading a shorter version of what they said.

Return only valid JSON: { "cleanTranscription": "...", "summary": "..." }`,
      },
      { role: 'user', content: rawTranscription },
    ],
    responseFormat: { type: 'json_object' },
  })
  const parsed = z
    .object({ cleanTranscription: z.string(), summary: z.string() })
    .parse(JSON.parse(synthResult.content as string))
  const { cleanTranscription, summary } = parsed
  logger.info({ summaryPreview: summary.slice(0, 80) }, 'Synthesis done')

  // 6. Insert into DB with original timestamp
  const voicenote = await prisma.voicenote.create({
    data: {
      userId: user.id,
      audioStorageUrl: audioUrl,
      rawTranscription,
      cleanTranscription,
      summary,
      createdAt: ORIGINAL_TIMESTAMP,
    },
  })
  logger.info({ voicenoteId: voicenote.id, createdAt: voicenote.createdAt }, '✅ Voicenote recovered and saved!')

  logger.info('--- RAW TRANSCRIPTION ---')
  logger.info(rawTranscription)
  logger.info('--- CLEAN TRANSCRIPTION ---')
  logger.info(cleanTranscription)
  logger.info('--- SUMMARY ---')
  logger.info(summary)
}

main()
  .catch((e) => {
    logger.error({ err: e }, 'Recovery failed')
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
