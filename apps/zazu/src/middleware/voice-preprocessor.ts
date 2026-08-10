import { ZazuContext } from '@zazu/skills-core';

export async function voicePreprocessor(ctx: ZazuContext, next: () => Promise<void>) {
  if (!ctx.message) return next();

  if ('text' in ctx.message) {
    ctx.textContent = ctx.message.text;
  }

  // Voice messages are handled entirely by voicenote-skill, which transcribes
  // in-process via the LLM client fallback chain.

  return next();
}
