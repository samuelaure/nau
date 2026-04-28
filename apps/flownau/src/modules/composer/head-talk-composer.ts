import { z } from 'zod'
import { composeDraft } from './draft-composer'

// ─── Typed output schema for the Hook-First head talk template ────────────────

export const HeadTalkCreativeSchema = z.object({
  hook: z.string().describe('Opening hook — max 2 sentences. Wins attention in the first 2 seconds.'),
  body: z.string().describe('Main content body — max 150 words. Short paragraphs, one idea each.'),
  cta: z.string().describe('Call to action — max 2 sentences. Closes the loop the hook opened.'),
  caption: z.string().describe('Social media caption for when the video is published.'),
  hashtags: z.array(z.string()).describe('8-12 relevant hashtags without # prefix.'),
})

export type HeadTalkCreative = z.infer<typeof HeadTalkCreativeSchema>

export interface HeadTalkInput {
  ideaText: string
  brandId: string
  templateId?: string
  personaId?: string
}

export interface HeadTalkOutput {
  creative: HeadTalkCreative
  caption: string
  hashtags: string[]
  templateId: string | null
  personaId: string | null
}

export async function composeHeadTalk(input: HeadTalkInput): Promise<HeadTalkOutput> {
  return composeDraft<HeadTalkCreative>({
    ...input,
    format: 'head_talk',
    outputSchema: HeadTalkCreativeSchema,
    schemaName: 'HeadTalkCreative',
  })
}
