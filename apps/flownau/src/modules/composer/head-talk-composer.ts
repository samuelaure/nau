import { getClientForFeature } from '@nau/llm-client'
import { z } from 'zod'
import { prisma } from '@/modules/shared/prisma'

const HeadTalkOutputSchema = z.object({
  script: z
    .string()
    .describe('A clean, structured teleprompter-ready script for the talking-head recording.'),
  caption: z
    .string()
    .describe('A compelling social media caption for when the video is published.'),
  hashtags: z.array(z.string()).describe('Relevant hashtags (without # prefix).'),
})

export type HeadTalkOutput = z.infer<typeof HeadTalkOutputSchema>

export interface HeadTalkInput {
  ideaText: string
  accountId: string
  personaId?: string
}

/**
 * HeadTalkComposer — produces a teleprompter script + caption + hashtags.
 * No video/image assets. The user records themselves and uploads the result.
 */
export async function composeHeadTalk(input: HeadTalkInput): Promise<HeadTalkOutput> {
  const { ideaText, accountId, personaId } = input

  const persona = personaId
    ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
    : ((await prisma.brandPersona.findFirst({ where: { accountId, isDefault: true } })) ??
      (await prisma.brandPersona.findFirst({ where: { accountId } })))

  const dna = persona?.systemPrompt ?? ''

  const { client: llm, model } = getClientForFeature('composition')
  const result = await llm.parseCompletion({
    model,
    temperature: 0.6,
    schema: HeadTalkOutputSchema as any,
    schemaName: 'HeadTalkOutput',
    messages: [
      {
        role: 'system',
        content: `You are a scriptwriter for a talking-head video format.
${dna ? `BRAND VOICE:\n${dna}\n\n` : ''}
Given an idea, produce:
1. A clean teleprompter script — conversational, direct-to-camera, paragraph form. No stage directions.
2. A social media caption for publishing (can include emoji).
3. 5–10 relevant hashtags.

Write in the brand's natural language (typically Spanish unless otherwise specified).`,
      },
      { role: 'user', content: ideaText },
    ],
    timeoutMs: 30_000,
  })

  return result.data as HeadTalkOutput
}
