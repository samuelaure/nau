import { ZazuContext } from '@zazu/skills-core';
import { voiceService } from '../voice-service';
import { logger } from '../lib/logger';

/**
 * Native middleware for media-to-text transformation.
 * Ensures all skills receive a unified `textContent` field.
 */
export async function voicePreprocessor(ctx: ZazuContext, next: () => Promise<void>) {
  if (!ctx.message) return next();

  // Handle Text Messages: Populate direct text Content.
  if ('text' in ctx.message) {
    ctx.textContent = ctx.message.text;
  }

  // Handle Voice Messages: Transcribe first.
  if ('voice' in ctx.message) {
    try {
      // Get file info from Telegram
      const fileId = ctx.message.voice.file_id;
      const fileUrl = await ctx.telegram.getFileLink(fileId);

      // Transcribe via service
      const transcription = await voiceService.transcribe(fileUrl.toString());
      
      // Inject unified content for skill manager to consume
      ctx.textContent = transcription;

      // Log transcription for context (optional: in a real app, send typing indicator)
      logger.info({ transcriptionLength: transcription.length }, 'Voice transcribed');
    } catch (error) {
      logger.error({ err: error }, 'Voice transcription failed in preprocessor');
      // We still pass to next, but textContent will be missing or skill can decide.
    }
  }

  return next();
}
