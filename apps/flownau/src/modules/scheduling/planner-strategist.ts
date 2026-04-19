import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'

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
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !input.strategistPrompt || input.pieces.length === 0) {
    return input.pieces.map((p) => p.id)
  }

  try {
    const openai = new OpenAI({ apiKey })

    const piecesText = input.pieces
      .map(
        (p, i) =>
          `${i + 1}. ID: ${p.id}\n   Format: ${p.format}\n   Idea: ${p.ideaText.slice(0, 200)}`,
      )
      .join('\n\n')

    const frequencyText =
      `Target: ${input.reelsPerDay} reels/day, ${input.trialReelsPerDay} trial reels/day, ` +
      `planning horizon: ${input.daysToPlan} days.`

    const completion = await openai.chat.completions.parse(
      {
        model: 'gpt-4o',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You are a content planning strategist. Order the given content pieces for maximum strategic impact.

STRATEGY GUIDELINES:
${input.strategistPrompt}

POSTING FREQUENCY:
${frequencyText}

Return ALL provided IDs in your preferred posting order. Do not omit any.`,
          },
          {
            role: 'user',
            content: `Order these ${input.pieces.length} content pieces:\n\n${piecesText}`,
          },
        ],
        response_format: zodResponseFormat(StrategistOutputSchema, 'StrategistOutput'),
      },
      { timeout: 30_000 },
    )

    const parsed = completion.choices[0]?.message?.parsed
    if (!parsed) throw new Error('Empty strategist response')

    // Validate: all original IDs must be present
    const inputIds = new Set(input.pieces.map((p) => p.id))
    const outputIds = new Set(parsed.orderedIds)
    const isComplete = input.pieces.every((p) => outputIds.has(p.id))

    if (!isComplete || parsed.orderedIds.length !== input.pieces.length) {
      throw new Error('Strategist returned incomplete or duplicate ID list')
    }

    return parsed.orderedIds.filter((id) => inputIds.has(id))
  } catch {
    // Graceful fallback: original order
    return input.pieces.map((p) => p.id)
  }
}
