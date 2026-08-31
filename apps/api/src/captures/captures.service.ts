import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { getFeatureFallbackChain, getClientForFeature } from '@nau/llm-client';
import { z } from 'zod';
import { JournalService } from '../relations/journal/journal.service';
import { PrivateStorageService } from '../core/storage/private-storage.service';

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
    private readonly journal: JournalService,
    private readonly storage: PrivateStorageService,
  ) {}

  /**
   * Cleans up a spoken transcription: removes filler and repetition while
   * keeping the meaning. Only ever applied to audio — typed text is stored as
   * written.
   *
   * Best-effort: if the model is unavailable the raw transcription is stored
   * unchanged, which is a far better failure than losing the capture.
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

  async captureText(params: {
    text: string;
    userId: string;
    workspaceId: string;
    capturedAt?: string;
  }) {
    const trimmed = params.text?.trim();
    if (!trimmed) throw new BadRequestException('text is required');

    // Written text is stored exactly as typed. Distillation exists to strip the
    // filler and false starts of speech; running it over something the user
    // deliberately wrote just rewrites their words in a model's voice, which is
    // the opposite of what a personal journal is for.
    const block = await this.journal.createEntry({
      text: trimmed,
      date: params.capturedAt,
      source: 'app',
      originFormat: 'text',
      workspaceId: params.workspaceId,
      userId: params.userId,
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

    // The audio and its untouched transcription stay here, with the capture
    // that produced them. What reaches the journal is the text — an entry is a
    // piece of writing, and what it was before it was writing belongs to
    // whoever did the capturing.
    const block = await this.journal.createEntry({
      text: distilled,
      date: params.capturedAt,
      source: 'app',
      originFormat: 'voice',
      workspaceId: params.workspaceId,
      userId: params.userId,
      sourceId: params.audioKey,
    });

    return { success: true, transcription: raw, block };
  }
}
