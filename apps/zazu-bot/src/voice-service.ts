import OpenAI, { toFile } from 'openai';
import fs from 'fs';
import axios from 'axios';
import path from 'path';

/**
 * Service to handle media-to-text transformation.
 * Specifically handles downloading and transcribing Telegram voice-notes via OpenAI Whisper.
 */
export class VoiceService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Transcribes a remotely hosted audio file.
   * @param fileUrl URL of the audio file to transcribe.
   * @param fileName Generic name for the file buffer (e.g., 'voice.ogg').
   * @returns Transcribed text.
   */
  async transcribe(fileUrl: string, fileName: string = 'voice.ogg'): Promise<string> {
    try {
      // Download file to a buffer or temporary storage. 
      // For simplicity and to avoid complex FS operations in high-throughput, we'll download to buffer.
      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'arraybuffer',
      });

      const buffer = Buffer.from(response.data);
      
      // OpenAI SDK supports `toFile` for passing buffers as file-like objects for Whisper.
      const transcription = await this.openai.audio.transcriptions.create({
        file: await toFile(buffer, fileName),
        model: 'whisper-1',
        language: 'es', // Preferred language for Zazŭ
      });

      return transcription.text;
    } catch (error) {
      console.error('Error during voice transcription:', error);
      throw new Error('No pude transcribir tu audio. Revisa mi clave de OpenAI o intenta de nuevo.');
    }
  }
}

export const voiceService = new VoiceService();
