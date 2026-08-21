import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { getFeatureFallbackChain, getClientForFeature } from '@nau/llm-client';
import { z } from 'zod';
import { BlocksService } from '../blocks/blocks.service';
import { PrivateStorageService } from '../media/private-storage.service';

const CleanedCapture = z.object({
  journalEntry: z
    .string()
    .describe(
      'A clear, reflective, first-person journal entry distilled from the raw capture. Preserve the personal tone and emotional context.',
    ),
});

/**
 * Journal captures from the web and the mobile app.
 *
 * Unlike Telegram, where one voice note might be a diary entry, a task or a
 * content idea and the user picks which, here the intent is implicit: the
 * capture came from the journal screen, so it is a journal entry. There is
 * nothing to disambiguate and therefore nothing to confirm.
 */
@Injectable()
export class CapturesService {
  private readonly logger = new Logger(CapturesService.name);

  constructor(
    private readonly blocks: BlocksService,
    private readonly storage: PrivateStorageService,
  ) {}

  /**
   * Turns raw text into an entry. The distillation is best-effort: if the model
   * is unavailable the user's own words are stored unchanged, which is a far
   * better failure than losing the capture.
   */
  private async distil(raw: string): Promise<string> {
    try {
      const { client, model } = getClientForFeature('triage');
      const result = await client.parseCompletion({
        model,
        temperature: 0.2,
        schema: CleanedCapture as never,
        schemaName: 'CleanedCapture',
        messages: [
          {
            role: 'system',
            content: `You receive a personal capture, spoken or written.
Distill it into a clear, reflective, first-person journal entry.
Preserve the personal tone, thoughts and emotional context.
Remove filler and repetition but keep the full meaning.
Do NOT invent detail, add advice, or produce tasks or ideas — only the entry.
Write in the same language as the input.`,
          },
          { role: 'user', content: raw },
        ],
      });
      return (result.data as { journalEntry?: string })?.journalEntry ?? raw;
    } catch (err) {
      this.logger.warn(`Distillation unavailable, storing raw text: ${String(err)}`);
      return raw;
    }
  }

  private async createEntry(params: {
    text: string;
    userId: string;
    workspaceId: string;
    capturedAt?: string;
    source: string;
    audioKey?: string;
    rawText?: string;
  }) {
    return this.blocks.createInternal({
      type: 'journal_entry',
      workspaceId: params.workspaceId,
      userId: params.userId,
      properties: {
        summary: params.text,
        // The raw capture is kept alongside the distilled version. The model
        // rewrites the user's words, and there should always be a way back to
        // what was actually said.
        raw: params.rawText ?? params.text,
        date: params.capturedAt ?? new Date().toISOString(),
        source: params.source,
        audioKey: params.audioKey,
        status: 'published',
      },
    });
  }

  async captureText(params: {
    text: string;
    userId: string;
    workspaceId: string;
    capturedAt?: string;
  }) {
    const trimmed = params.text?.trim();
    if (!trimmed) throw new BadRequestException('text is required');

    const distilled = await this.distil(trimmed);
    const block = await this.createEntry({
      ...params,
      text: distilled,
      rawText: trimmed,
      source: 'web_text',
    });

    return { success: true, block };
  }

  /**
   * The audio is already in the private bucket: the client uploaded it directly
   * with a presigned URL, so it never travels through this server. Only the key
   * arrives here.
   */
  async captureVoice(params: {
    audioKey: string;
    userId: string;
    workspaceId: string;
    capturedAt?: string;
    source?: string;
  }) {
    if (!params.audioKey) throw new BadRequestException('audioKey is required');

    const audio = await this.storage.download(params.audioKey);

    const chain = getFeatureFallbackChain('transcription');
    let raw = '';
    let lastError: unknown;

    for (const { client, model } of chain) {
      try {
        const result = await client.transcribe({
          model,
          file: new File([new Uint8Array(audio)], 'capture.ogg', { type: 'audio/ogg' }) as never,
        });
        raw = result.text;
        break;
      } catch (err) {
        // Each provider is tried in turn; only a total failure is fatal.
        lastError = err;
        this.logger.warn(`Transcription failed on ${model}: ${String(err)}`);
      }
    }

    if (!raw) {
      throw new BadRequestException(
        `Could not transcribe the audio: ${String(lastError ?? 'no provider available')}`,
      );
    }

    const distilled = await this.distil(raw);
    const block = await this.createEntry({
      ...params,
      text: distilled,
      rawText: raw,
      source: params.source ?? 'web_voice',
      audioKey: params.audioKey,
    });

    return { success: true, transcription: raw, block };
  }
}
