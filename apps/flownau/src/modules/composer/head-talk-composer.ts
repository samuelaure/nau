import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
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
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

  const { ideaText, accountId, personaId } = input

  const persona = personaId
    ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
    : ((await prisma.brandPersona.findFirst({ where: { accountId, isDefault: true } })) ??
      (await prisma.brandPersona.findFirst({ where: { accountId } })))

  const dna = persona?.systemPrompt ?? ''

  const openai = new OpenAI({ apiKey })

  const completion = await openai.chat.completions.parse(
    {
      model: 'gpt-4o',
      temperature: 0.6,
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
      response_format: zodResponseFormat(HeadTalkOutputSchema, 'HeadTalkOutput'),
    },
    { timeout: 30_000 },
  )

  const parsed = completion.choices[0].message.parsed
  if (!parsed) throw new Error('Failed to parse head_talk AI response.')
  return parsed
}
