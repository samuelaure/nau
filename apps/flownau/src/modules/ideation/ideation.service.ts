import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'

const IdeationOutputSchema = z.object({
  ideas: z.array(
    z.object({
      hook: z.string().describe('A compelling opening hook for the content piece.'),
      angle: z.string().describe('The unique angle or perspective for this idea.'),
      script: z.string().describe('A full content script or narrative, ready for recording.'),
      cta: z.string().describe('A call-to-action suggestion.'),
      format: z
        .enum(['reel', 'trial_reel', 'head_talk', 'carousel', 'single_image'])
        .describe('Recommended content format.'),
      inspoItemId: z
        .string()
        .nullable()
        .optional()
        .describe('ID of the InspoItem that inspired this idea.'),
    }),
  ),
  briefSummary: z.string().describe('A brief meta-summary of the ideation session.'),
})

export type IdeationOutput = z.infer<typeof IdeationOutputSchema>

/**
 * Unified generation request used by all three origins:
 *   - Origin 1 (Captured): concept = voice transcript / capture text
 *   - Origin 2 (Manual): concept = operator input
 *   - Origin 3 (Automatic): digest from nauthenticity synthesis engine; concept omitted
 */
export interface GenerationRequest {
  brandName: string
  dna: string // Brand DNA (persona system prompt)
  strategy?: string // Optional IdeasFramework prompt for creative direction
  count: number // How many ideas to generate
  concept?: string // Source concept driving this generation (captured/manual origin)
  digest?: { content: string; attachedUrls: string[] } // Phase 11: mechanical InspoBase digest
  inspoItems?: InspoItemInput[] // Legacy: individual InspoItems (used by v1/ideation/cron)
  recentContent?: string[]
}

interface InspoItemInput {
  id: string
  type: string
  note: string | null
  extractedHook: string | null
  extractedTheme: string | null
  adaptedScript: string | null
  postCaption?: string | null
  postTranscript?: string | null
}

export async function generateContentIdeas(req: GenerationRequest): Promise<IdeationOutput> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Cannot generate content ideas.')
  }

  const openai = new OpenAI({ apiKey })

  let contextBlock = ''

  contextBlock += `## BRAND DNA\n${req.dna}\n\n`

  if (req.strategy) {
    contextBlock += `## IDEATION STRATEGY\n${req.strategy}\n\n`
  }

  if (req.concept) {
    contextBlock += `## SOURCE CONCEPT\nGenerate ideas directly inspired by this concept:\n${req.concept}\n\n`
  }

  if (req.digest) {
    contextBlock += `## CREATIVE DIGEST\nThis is the brand's current creative direction synthesized from recent inspiration:\n${req.digest.content}\n\n`
    if (req.digest.attachedUrls.length > 0) {
      contextBlock += `Reference posts that shaped this direction:\n`
      req.digest.attachedUrls.forEach((url) => {
        contextBlock += `- ${url}\n`
      })
      contextBlock += '\n'
    }
  }

  if (req.inspoItems && req.inspoItems.length > 0) {
    contextBlock += `## INSPO BASE (${req.inspoItems.length} items)\n`
    req.inspoItems.forEach((item, i) => {
      contextBlock += `### Item ${i + 1} (${item.type}) [ID: ${item.id}]\n`
      if (item.note) contextBlock += `User Note: ${item.note}\n`
      if (item.extractedHook) contextBlock += `Hook: ${item.extractedHook}\n`
      if (item.extractedTheme) contextBlock += `Theme: ${item.extractedTheme}\n`
      if (item.postCaption) contextBlock += `Caption: ${item.postCaption}\n`
      if (item.postTranscript) contextBlock += `Transcript: ${item.postTranscript}\n`
      if (item.adaptedScript) contextBlock += `Adapted Script: ${item.adaptedScript}\n`
      contextBlock += '\n'
    })
  }

  if (req.recentContent && req.recentContent.length > 0) {
    contextBlock += `## RECENT PUBLISHED CONTENT (avoid repetition)\n`
    req.recentContent.forEach((p) => {
      contextBlock += `- ${p}\n`
    })
    contextBlock += '\n'
  }

  const completion = await openai.chat.completions.parse(
    {
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are the Content Ideation Engine for "${req.brandName}".
Generate exactly ${req.count} fresh, high-quality content ideas.

RULES:
1. Each idea must have a compelling hook, a unique angle, a full script, and a CTA.
2. Reference inspoItemIds when an idea is directly inspired by a specific InspoItem.
3. Recommend the best format for each idea: reel (short video), trial_reel (test/experimental reel), head_talk (talking-head recording), carousel (swipeable slides), single_image (static post).
4. Avoid repeating topics from "Recent Published Content".
5. Honor the Brand DNA for tone, voice, and values.
6. If a Source Concept is provided, all ideas must be directly inspired by it.
7. Write scripts in the brand's natural language (typically Spanish).

Return valid JSON matching the schema.`,
        },
        {
          role: 'user',
          content: contextBlock,
        },
      ],
      response_format: zodResponseFormat(IdeationOutputSchema, 'IdeationOutput'),
    },
    { timeout: 60_000 },
  )

  const parsed = completion.choices[0].message.parsed
  if (!parsed) {
    throw new Error('Failed to parse ideation AI response.')
  }

  return parsed as IdeationOutput
}
