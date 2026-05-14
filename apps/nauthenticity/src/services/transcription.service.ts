import fs from 'fs'
import { getFeatureFallbackChain } from '@nau/llm-client'
import { logger } from '../utils/logger'

export interface TranscriptionResult {
  text: string
}

export const transcribeAudio = async (filePath: string): Promise<TranscriptionResult> => {
  const chain = getFeatureFallbackChain('transcription')
  let lastError: unknown

  for (const { client, model, registryId } of chain) {
    try {
      const result = await client.transcribe({ model, file: fs.createReadStream(filePath) })
      return { text: result.text }
    } catch (err) {
      logger.warn({ registryId, err }, 'transcription provider failed, trying next in chain')
      lastError = err
    }
  }

  throw lastError
}
