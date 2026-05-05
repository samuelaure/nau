import { getAdminModelClient } from '@/modules/shared/admin-model'
import { z } from 'zod'
import { buildPrompt } from '@/modules/prompts/kernel'

const IdeationOutputSchema = z.object({
  ideas: z.array(
    z.object({
      concept: z
        .string()
        .describe(
          'A single standalone paragraph (25–40 words) built from the three sharing mechanisms: identity-signal thesis, knowledge-gap insight, reframe/implication.',
        ),
      angle: z
        .enum(['direct', 'complementary', 'indirect'])
        .describe('Which prism angle this idea uses.'),
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
  topic: string
  language?: string
  count: number
  recentContent?: string[]
  userInstructions?: string | null
  brandContext?: string | null
}

export async function generateContentIdeas(req: GenerationRequest): Promise<IdeationOutputWithTrace> {
  if (!req.topic?.trim()) {
    throw new Error('Topic is required for idea generation.')
  }

  const language = req.language ?? 'Spanish'

  const { systemPrompt, layers } = buildPrompt({
    base: 'ideation',
    brandContext: req.brandContext,
    customPrompt: req.userInstructions,
    language,
  })

  const userMessage = buildUserMessage(req)

  const { client: llm, model, registryId, provider } = await getAdminModelClient('ideation')

  const result = await llm.parseCompletion({
    model,
    temperature: 0.8,
    schema: IdeationOutputSchema as any,
    schemaName: 'IdeationOutput',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
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

function buildUserMessage(req: GenerationRequest): string {
  let msg = `Generate exactly ${req.count} ideas about:\n\n${req.topic}`

  if (req.recentContent && req.recentContent.length > 0) {
    msg += `\n\nRECENT PUBLISHED CONTENT — do not repeat these topics:\n`
    req.recentContent.forEach((c) => { msg += `- ${c}\n` })
  }

  return msg
}
