import { getClientForFeature } from '@nau/llm-client'
import { z } from 'zod'

const IdeationOutputSchema = z.object({
  ideas: z.array(
    z.object({
      concept: z
        .string()
        .describe(
          'A single standalone paragraph (25–40 words) built from the three sharing mechanisms: identity-signal thesis, knowledge-gap insight, reframe/implication.',
        ),
    }),
  ),
  briefSummary: z.string().describe('One sentence summarising the session.'),
})

export type IdeationOutput = z.infer<typeof IdeationOutputSchema>

export interface LlmTrace {
  provider: string
  model: string
  registryId: string
  systemPrompt: string
  userMessage: string
  generatedAt: string
}

export interface IdeationOutputWithTrace extends IdeationOutput {
  trace: LlmTrace
}

export interface GenerationRequest {
  topic: string        // Required. Manual input, capture text, or digest. NO TOPIC = blocked.
  language?: string    // Brand content language (e.g. 'Spanish', 'English'). Default: 'Spanish'.
  count: number        // How many ideas to generate.
  recentContent?: string[]  // Recent published captions — avoid repeating these topics.
  userInstructions?: string | null  // Brand-specific ideation prompt — injected with highest priority.
}

export async function generateContentIdeas(req: GenerationRequest): Promise<IdeationOutputWithTrace> {
  if (!req.topic?.trim()) {
    throw new Error('Topic is required for idea generation.')
  }

  const language = req.language ?? 'Spanish'

  const creatorBlock = req.userInstructions?.trim()
    ? `⚠️ CREATOR INSTRUCTIONS — these take absolute precedence over all guidelines below. Follow them exactly; let them shape the ideas above everything else:\n\n<creator_instructions>\n${req.userInstructions.trim()}\n</creator_instructions>\n\nAll default rules below are subordinate to the above.\n\n---\n\n`
    : ''

  const systemPrompt = `${creatorBlock}Generate exactly ${req.count} concept ideas that exploit the three mechanisms that drive sharing on short-form platforms:

1. IDENTITY SIGNAL — content that lets the viewer signal something about who they are by sharing it ("this is so me", "this is what I believe", "this is my world"). The viewer is the hero, not the brand.

2. KNOWLEDGE GAP — content that creates a felt sense of missing something the viewer should know. The hook names the gap. The body closes it. Closing it feels like winning.

3. PATTERN INTERRUPT — content that violates an expectation the viewer didn't know they had. A counterintuitive claim, a reversal, a reframe of something familiar.

IDEA SELECTION CRITERIA (in priority order):
- Would someone share this to say something about themselves? (identity signal)
- Does it answer a question the audience is already asking silently? (latent demand)
- Is the angle specific enough to feel like insider knowledge? (niche resonance)
- Can it be executed without special equipment or location? (production viability)
- Will it still be true in 12 months? (evergreen > trend-dependent)

AVOID:
- Ideas that inform but do not provoke a reaction
- Ideas that require a pre-existing relationship with the brand to land
- Ideas where the angle is "we're great" dressed up as content
- Any idea that sounds like it came from an LLM (generic, lacks personality, no point of view)

LANGUAGE: Write the ideas in ${language}

OUTPUT FORMAT (CRITICAL):
Write each idea as a single standalone paragraph (25–40 words) using this exact structure:
- Start with a strong, shareable identity-based thesis (a clear, slightly provocative statement someone would repost to express who they are).
- Follow with one concise sentence that closes a knowledge gap using a concrete, simple insight or distinction.
- End with a brief reframe or implication that makes the idea feel like a perspective shift ("this changes everything").
- Additional rules: no lists, no labels, no explanations, no meta commentary; use plain language; keep it tight and direct; each idea must read like a quotable statement.

WRITE THE IDEAS ABOUT THIS TOPIC:`

  let userMessage = `${req.topic}`

  if (req.recentContent && req.recentContent.length > 0) {
    userMessage += `RECENT PUBLISHED CONTENT (avoid repeating these topics):\n`
    req.recentContent.forEach((c) => {
      userMessage += `- ${c}\n`
    })
  }

  const { client: llm, model, registryId, provider } = getClientForFeature('ideation')

  const result = await llm.parseCompletion({
    model,
    temperature: 0.8,
    schema: IdeationOutputSchema as any,
    schemaName: 'IdeationOutput',
    messages: [
      { role: 'system', content: systemPrompt },
      ...(userMessage ? [{ role: 'user' as const, content: userMessage }] : []),
    ],
    timeoutMs: 60_000,
  })

  const data = result.data as IdeationOutput
  return {
    ...data,
    trace: {
      provider,
      model,
      registryId,
      systemPrompt,
      userMessage,
      generatedAt: new Date().toISOString(),
    },
  }
}
