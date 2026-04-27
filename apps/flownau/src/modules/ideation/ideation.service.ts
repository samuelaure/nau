import { getClientForFeature } from '@nau/llm-client'
import { z } from 'zod'

const IdeationOutputSchema = z.object({
  ideas: z.array(
    z.object({
      concept: z
        .string()
        .describe(
          'The content idea as a short plain-text concept (2–4 sentences max). No scripts, no CTAs, not an explanation of the idea — just the core concept and angle expressed as a hook.',
        ),
      format: z
        .enum(['reel', 'trial_reel', 'head_talk', 'carousel', 'static_post', 'story'])
        .describe('Best format for this idea.'),
      inspoItemId: z
        .string()
        .describe('ID of the InspoItem that inspired this idea, or empty string if none.'),
    }),
  ),
  briefSummary: z.string().describe('One sentence summarising the session.'),
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
  language?: string // Brand content language (e.g. 'Spanish', 'English', 'Italian')
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
  const { client: llm, model } = getClientForFeature('ideation')

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

  const result = await llm.parseCompletion({
    model,
    temperature: 0.7,
    schema: IdeationOutputSchema as any,
    schemaName: 'IdeationOutput',
    messages: [
      {
        role: 'system',
        content: `You are the Content Ideation Engine for "${req.brandName}".
Generate exactly ${req.count} ideas.

WHAT AN IDEA IS:
The content idea as a short plain-text concept (2–4 sentences max). No scripts, no CTAs, not an explanation of the idea — just the core concept and angle expressed as a hook.

RULES:
1. Each idea must be written as plain natural language. No headers, no labels like "Hook:", "Script:", "CTA:" — just the concept.
2. Keep each idea to 2–4 sentences maximum.
3. Pick the best format: reel (short video), trial_reel (experimental/test reel), head_talk (talking-head, no extra footage), carousel (swipeable slides), static_post (single image), story (Instagram/TikTok story).
4. Set inspoItemId to the ID of the inspiring InspoItem, or empty string if none.
5. Avoid repeating topics from "Recent Published Content".
6. Honor the Brand DNA for tone, voice, and values.
7. If a Source Concept is provided, expand on it — generate ideas directly inspired by it.
8. Write every idea in ${req.language ?? 'Spanish'}.

Return valid JSON matching the schema.`,
      },
      {
        role: 'user',
        content: contextBlock,
      },
    ],
    timeoutMs: 60_000,
  })

  return result.data as IdeationOutput
}
