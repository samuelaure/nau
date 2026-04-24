import { createDefaultLLMClient, toFile, type LLMClient } from '@nau/llm-client'
import axios from 'axios'
import { logger } from './lib/logger'

export class VoiceService {
  private llm: LLMClient

  constructor() {
    this.llm = createDefaultLLMClient()
  }

  async transcribe(fileUrl: string, fileName: string = 'voice.ogg'): Promise<string> {
    try {
      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'arraybuffer',
      })

      const buffer = Buffer.from(response.data)
      const file = await toFile(buffer, fileName)

      const result = await this.llm.transcribe({
        model: process.env.LLM_TRANSCRIPTION_MODEL ?? 'whisper-1',
        file,
        language: 'es',
      })
      return result.text
    } catch (error) {
      logger.error({ err: error }, 'Voice transcription failed')
      throw new Error('No pude transcribir tu audio. Revisa mi clave de OpenAI o intenta de nuevo.')
    }
  }
}

export const voiceService = new VoiceService()
