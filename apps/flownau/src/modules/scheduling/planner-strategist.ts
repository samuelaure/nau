import { getClientForFeature } from '@nau/llm-client'
import { z } from 'zod'

const StrategistOutputSchema = z.object({
  orderedIds: z
    .array(z.string())
    .describe(
      'Composition IDs ordered by posting priority (index 0 = post first). Must include all provided IDs.',
    ),
  reasoning: z.string().describe('Brief explanation of the ordering strategy chosen.'),
})

export type StrategistOutput = z.infer<typeof StrategistOutputSchema>

interface PieceInput {
  id: string
  ideaText: string
  format: string
}

interface StrategistInput {
  strategistPrompt: string
  pieces: PieceInput[]
  reelsPerDay: number
  trialReelsPerDay: number
  daysToPlan: number
}

/**
 * AI planner-strategist: given an unordered list of approved compositions,
 * returns them sorted by posting priority according to the brand's strategist prompt.
 *
 * Only the minimal payload (id, ideaText, format) is sent — token-economic.
 * Falls back to creation-order if AI call fails.
 */
export async function runPlannerStrategist(input: StrategistInput): Promise<string[]> {
  if (!input.strategistPrompt || input.pieces.length === 0) {
    return input.pieces.map((p) => p.id)
  }

  try {
    const { client: llm, model } = getClientForFeature('planning')

    const piecesText = input.pieces
      .map(
        (p, i) =>
          `${i + 1}. ID: ${p.id}\n   Format: ${p.format}\n   Idea: ${p.ideaText.slice(0, 200)}`,
      )
      .join('\n\n')

    const frequencyText =
      `Target: ${input.reelsPerDay} reels/day, ${input.trialReelsPerDay} trial reels/day, ` +
      `planning horizon: ${input.daysToPlan} days.`

    const result = await llm.parseCompletion({
      model,
      temperature: 0.3,
      schema: StrategistOutputSchema,
      schemaName: 'StrategistOutput',
      messages: [
        {
          role: 'system',
          content: `You are a content scheduling strategist. Given a list of approved content pieces and the brand's strategic posting guidelines, reorder them by posting priority.

BRAND STRATEGY:
${input.strategistPrompt}

POSTING FREQUENCY:
${frequencyText}

RULES:
1. Return ALL provided IDs in orderedIds — no additions or omissions.
2. Prioritize variety of format and topic to avoid audience fatigue.
3. Lead with highest-engagement formats (reels before carousels, etc.).
4. Provide a brief reasoning for the chosen order.`,
        },
        {
          role: 'user',
          content: `Please prioritize these ${input.pieces.length} content pieces:\n\n${piecesText}`,
        },
      ],
      timeoutMs: 30_000,
    })

    const ordered = result.data.orderedIds
    const allIds = new Set(input.pieces.map((p) => p.id))
    if (ordered.length !== input.pieces.length || !ordered.every((id) => allIds.has(id))) {
      throw new Error('AI returned invalid or incomplete orderedIds')
    }

    return ordered
  } catch {
    return input.pieces.map((p) => p.id)
  }
}
