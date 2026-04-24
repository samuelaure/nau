import { getClientForFeature } from '@nau/llm-client';
import OpenAI from 'openai';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface TranscriptionResult {
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json?: any;
}

export const transcribeAudio = async (filePath: string): Promise<TranscriptionResult> => {
  // Local Whisper path: custom base URL (self-hosted model)
  if (config.transcription.url && !config.transcription.url.includes('openai.com')) {
    logger.info(`[Transcription] Using local Whisper @ ${config.transcription.url}`);
    const client = new OpenAI({ apiKey: 'local-no-key', baseURL: `${config.transcription.url}/v1` });
    const result = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'Systran/faster-whisper-base',
    });
    return { text: result.text, json: result };
  }

  // Default path: use the abstraction layer (switches provider via registry)
  logger.info('[Transcription] Using registry transcription client');
  const { client, model } = getClientForFeature('transcription');
  const result = await client.transcribe({ model, file: fs.createReadStream(filePath) });
  return { text: result.text };
};
