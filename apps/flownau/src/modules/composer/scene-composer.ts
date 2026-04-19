import OpenAI from 'openai'
import { Groq } from 'groq-sdk'
import { zodResponseFormat } from 'openai/helpers/zod'
import { prisma } from '@/modules/shared/prisma'
import { resolveModelId } from '@/modules/composer/model-resolver'
import { getSetting } from '@/modules/shared/settings'
import { logError, logger } from '@/modules/shared/logger'
import {
  CreativeDirectionSchema,
  formatSceneCatalogForAI,
  type CreativeDirection,
} from '@/types/scenes'
import type { ContentFormat } from '@/types/content'

interface ComposeInput {
  ideaText: string
  accountId: string
  format: ContentFormat
  personaId?: string
  // Phase 18: explicit provenance inputs (set by composer cron from ContentIdea)
  frameworkPrompt?: string | null
  principlesPrompt?: string | null
  templateContentSchema?: unknown | null
  templateSystemPrompt?: string | null
}

interface ComposeResult {
  creative: CreativeDirection
  personaName: string
}

/**
 * SceneComposer — the AI Creative Director.
 *
 * Takes a content idea and produces a CreativeDirection:
 * - Scene sequence with typed text slots
 * - Caption and hashtags
 * - Cover scene index
 * - Audio mood suggestion
 *
 * The AI does NOT design layout or pick assets — it fills text slots
 * and selects scene types from the catalog.
 */
export async function compose(input: ComposeInput): Promise<ComposeResult> {
  const {
    ideaText,
    accountId,
    format,
    personaId,
    frameworkPrompt,
    principlesPrompt,
    templateContentSchema,
    templateSystemPrompt,
  } = input

  // 1. Fetch Brand Persona
  const persona = personaId
    ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
    : ((await prisma.brandPersona.findFirst({ where: { accountId, isDefault: true } })) ??
      (await prisma.brandPersona.findFirst({ where: { accountId } })))

  if (!persona) {
    throw new Error(`[SceneComposer] No Brand Persona found for account ${accountId}`)
  }

  // 2. Fetch asset tag summary for context (not URLs, just metadata)
  const assets = await prisma.asset.findMany({
    where: { accountId },
    select: { tags: true, type: true },
  })

  const uniqueTags = [...new Set(assets.flatMap((a) => a.tags))].filter(Boolean)
  const assetSummary =
    uniqueTags.length > 0
      ? `Available asset tags: ${uniqueTags.join(', ')}`
      : 'No tagged assets available. Use generic scene moods.'

  // 3. Resolve AI model
  const { provider, model } = resolveModelId(persona.modelSelection)
  const groqKey = (await getSetting('groq_api_key')) ?? process.env.GROQ_API_KEY ?? null
  const openaiKey = (await getSetting('openai_api_key')) ?? process.env.OPENAI_API_KEY ?? null

  // 4. Build system prompt
  const isImage = format === 'carousel' || format === 'static_post'
  const sceneFormat = isImage ? 'image' : 'video'

  const formatGuide =
    format === 'reel' || format === 'trial_reel'
      ? 'Compose a sequence of 4-7 scenes for a short-form video reel (10-20 seconds total).'
      : format === 'carousel'
        ? 'Compose 5-10 slides for an Instagram carousel. Start with a cover-slide, end with a cta-slide.'
        : 'Compose a single impactful image scene (1 scene only).'

  const formatRules = isImage
    ? `RULES:
1. Use ONLY image scene types from the catalog.
2. For carousel: start with 'cover-slide', end with 'cta-slide'. Middle slides are content-slide, quote-slide, or list-slide.
3. For single_image: compose exactly 1 scene (cover-slide or content-slide work best).
4. Fill each scene's text slots. Respect max character limits strictly.
5. Write a compelling Instagram caption (max 2000 chars). Use line breaks.
6. Suggest 5-15 relevant hashtags (without the # symbol).
7. Set coverSceneIndex to 0 (first slide is always the cover).
8. Write ALL text in the brand's natural language.
9. Aim for 5-8 slides in a carousel. Quality over quantity.`
    : `RULES:
1. Start with a hook scene (hook-text or text-over-media with a hook). End with a cta-card.
2. Use 'text-over-media' scenes heavily — they work best with B-roll content.
3. Fill each scene's text slots according to the slot schema. Respect max character limits strictly.
4. Suggest a mood keyword per scene for asset matching (e.g. "nature", "urban", "food", "workspace").
5. Write a compelling Instagram caption (max 2000 chars). Use line breaks for readability.
6. Suggest 5-15 relevant hashtags (without the # symbol).
7. Pick which scene index (0-based) should be the cover/thumbnail (coverSceneIndex).
8. Write ALL text content in the brand's natural language.
9. Keep the total under 7 scenes for reels. Quality over quantity.
10. Use 'media-only' scenes for breathing room between text-heavy scenes.
11. Use 'transition' scenes sparingly (max 1 per reel).`

  const strategyBlock = frameworkPrompt
    ? `\n\nIDEATION STRATEGY (carry forward from ideation):\n${frameworkPrompt}`
    : ''
  const principlesBlock = principlesPrompt
    ? `\n\nCONTENT CREATION PRINCIPLES (engagement/virality best practices):\n${principlesPrompt}`
    : ''
  const templatePromptBlock = templateSystemPrompt
    ? `\n\nTEMPLATE NARRATIVE GUIDANCE:\n${templateSystemPrompt}`
    : ''
  const contentSchemaBlock = templateContentSchema
    ? `\n\nTEMPLATE CONTENT SCHEMA (text-slot specs — follow exactly):\n${JSON.stringify(templateContentSchema, null, 2)}`
    : ''

  const systemPrompt = `You are a Senior Creative Director for short-form social media content.

BRAND VOICE:
${persona.systemPrompt}${strategyBlock}${principlesBlock}${templatePromptBlock}${contentSchemaBlock}

AVAILABLE SCENE TYPES:
${formatSceneCatalogForAI(sceneFormat)}

${assetSummary}

FORMAT: ${format}
${formatGuide}

${formatRules}`

  // 5. Make AI call with structured output
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Create content based on this idea:\n\n${ideaText}` },
  ]

  let creative: CreativeDirection

  try {
    creative = await callAI(provider, model, messages, groqKey, openaiKey)
  } catch (firstError: unknown) {
    // Retry once with error feedback
    const errorMsg = firstError instanceof Error ? firstError.message : String(firstError)
    logger.warn(`[SceneComposer] First attempt failed, retrying with feedback: ${errorMsg}`)

    messages.push({
      role: 'user',
      content: `Your previous response was invalid: ${errorMsg}\n\nPlease fix and try again. Ensure all slot values respect the max character limits and scene types are valid.`,
    })

    try {
      creative = await callAI(provider, model, messages, groqKey, openaiKey)
    } catch (secondError: unknown) {
      const msg = secondError instanceof Error ? secondError.message : String(secondError)
      logError(
        `[SceneComposer] Both attempts failed for idea: ${ideaText.slice(0, 100)}`,
        secondError,
      )
      throw new Error(`[SceneComposer] Composition failed after 2 attempts: ${msg}`)
    }
  }

  // 6. Clamp coverSceneIndex to valid range
  if (creative.coverSceneIndex >= creative.scenes.length) {
    creative.coverSceneIndex = 0
  }

  return { creative, personaName: persona.name }
}

/**
 * Calls the AI provider with structured output and validates the response.
 */
async function callAI(
  provider: 'openai' | 'groq',
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  groqKey: string | null,
  openaiKey: string | null,
): Promise<CreativeDirection> {
  if (provider === 'openai') {
    if (!openaiKey) throw new Error('OPENAI_API_KEY is not configured')
    const openai = new OpenAI({ apiKey: openaiKey })

    // The OpenAI SDK types beta.chat.completions.parse as returning any.
    // We accept that here and validate the parsed value with Zod immediately after.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion: any = await openai.chat.completions.parse(
      {
        model,
        temperature: 0.7,
        messages,
        response_format: zodResponseFormat(CreativeDirectionSchema, 'CreativeDirection'),
      },
      { timeout: 60000 },
    )

    const parsed: unknown = completion.choices[0]?.message?.parsed
    if (!parsed) throw new Error('OpenAI returned empty parsed response')

    // Validate with Zod
    return CreativeDirectionSchema.parse(parsed)
  }

  // Groq fallback — no structured outputs, parse JSON manually
  if (!groqKey) throw new Error('GROQ_API_KEY is not configured')
  const groq = new Groq({ apiKey: groqKey })

  const completion = await groq.chat.completions.create(
    {
      model,
      temperature: 0.7,
      messages: [
        ...messages,
        {
          role: 'user',
          content:
            'Respond with ONLY valid JSON matching the CreativeDirection schema. No markdown, no explanation.',
        },
      ],
    },
    { timeout: 30_000 },
  )

  const raw = completion.choices[0]?.message?.content?.trim()
  if (!raw) throw new Error('Groq returned empty response')

  // Extract JSON from potential markdown code blocks
  const jsonStr = raw.startsWith('{')
    ? raw
    : raw
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseErr) {
    throw new Error(
      `[SceneComposer] Groq returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. Raw: ${jsonStr.slice(0, 200)}`,
    )
  }
  return CreativeDirectionSchema.parse(parsed)
}
