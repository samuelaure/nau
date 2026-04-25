import fs from 'fs'
import { getClientForFeature } from '@nau/llm-client'

export interface TranscriptionResult {
  text: string
}

export const transcribeAudio = async (filePath: string): Promise<TranscriptionResult> => {
  const { client, model } = getClientForFeature('transcription')
  const result = await client.transcribe({ model, file: fs.createReadStream(filePath) })
  return { text: result.text }
}
