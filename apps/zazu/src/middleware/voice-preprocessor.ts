import { ZazuContext } from '@zazu/skills-core';

export async function voicePreprocessor(ctx: ZazuContext, next: () => Promise<void>) {
  if (!ctx.message) return next();

  if ('text' in ctx.message) {
    ctx.textContent = ctx.message.text;
  }

  // Voice messages are handled entirely by voicenote-skill, which delegates
  // transcription + synthesis to nauthenticity. No local transcription here.

  return next();
}
