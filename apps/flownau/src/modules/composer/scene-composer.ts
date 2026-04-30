import { createLLMClient, type LLMClient } from '@nau/llm-client'
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

const PLATFORM_DEFAULT_CREATIVE_PERSONA = {
  name: 'Platform Default',
  systemPrompt: `You are a versatile, professional content creator. Communicate clearly and engagingly. Use compelling storytelling and vivid, descriptive language. Keep content professional yet approachable, and always lead with value for the audience. Adapt tone to the subject matter — educational, inspirational, or entertaining as needed.`,
  modelSelection: 'GROQ_LLAMA_3_3' as const,
}

interface ComposeInput {
  ideaText: string
  brandId: string
  format: ContentFormat
  personaId?: string
  // Phase 18: explicit provenance inputs (set by composer cron from ContentIdea)
  frameworkPrompt?: string | null
  principlesPrompt?: string | null
  templateContentSchema?: unknown | null
  templateSystemPrompt?: string | null
  // Brand-specific custom instructions for this template — injected at highest priority
  customPrompt?: string | null
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
    brandId,
    format,
    personaId,
    frameworkPrompt,
    principlesPrompt,
    templateContentSchema,
    templateSystemPrompt,
    customPrompt,
  } = input

  // 1. Fetch Brand Persona
  const persona = personaId
    ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
    : ((await prisma.brandPersona.findFirst({ where: { brandId, isDefault: true } })) ??
      (await prisma.brandPersona.findFirst({ where: { brandId } })))

  const effectivePersona = persona ?? PLATFORM_DEFAULT_CREATIVE_PERSONA

  // 2. Fetch asset tag summary for context (not URLs, just metadata)
  const assets = await prisma.asset.findMany({
    where: { brandId: brandId },
    select: { tags: true, type: true },
  })

  const uniqueTags = [...new Set(assets.flatMap((a) => a.tags))].filter(Boolean)
  const assetSummary =
    uniqueTags.length > 0
      ? `Available asset tags: ${uniqueTags.join(', ')}`
      : 'No tagged assets available. Use generic scene moods.'

  // 3. Resolve AI model
  const { provider, model } = resolveModelId(effectivePersona.modelSelection)
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
4. CRITICAL: For every scene, copy the exact slot keys shown in the catalog and fill them with real content. Never output an empty slots object {}.
5. Write a compelling Instagram caption (max 2000 chars). Use line breaks.
6. Suggest 5-15 relevant hashtags (without the # symbol).
7. Set coverSceneIndex to 0 (first slide is always the cover).
8. Write ALL text in the brand's natural language.
9. Aim for 5-8 slides in a carousel. Quality over quantity.`
    : `RULES:
1. Start with a hook scene (hook-text or text-over-media with a hook). End with a cta-card.
2. Use 'text-over-media' scenes heavily — they work best with B-roll content.
3. CRITICAL: For every scene, copy the EXACT slot keys shown in the catalog and fill them with REAL, SPECIFIC content. Never output an empty slots object {}. Only media-only and transition may have empty slots — all other scene types MUST have slots filled.
4. Suggest a mood keyword per scene for asset matching (e.g. "nature", "urban", "food", "workspace").
5. Write a compelling Instagram caption (max 2000 chars). Use line breaks for readability.
6. Suggest 5-15 relevant hashtags (without the # symbol).
7. Pick which scene index (0-based) should be the cover/thumbnail (coverSceneIndex).
8. Write ALL text content in the brand's natural language.
9. Keep the total under 7 scenes for reels. Quality over quantity.
10. Use 'media-only' scenes for breathing room between text-heavy scenes.
11. Use 'transition' scenes sparingly (max 1 per reel).

OUTPUT FORMAT — respond with a SINGLE JSON object exactly like this (all scenes inside the "scenes" array):
{
  "scenes": [
    {"type":"hook-text","slots":{"hook":"You're doing it wrong — here's why"},"mood":"urban"},
    {"type":"text-over-media","slots":{"text":"Most people skip this critical step every single day"},"mood":"workspace"},
    {"type":"quote-card","slots":{"quote":"The best investment is in yourself","attribution":"Warren Buffett"},"mood":"inspiration"},
    {"type":"cta-card","slots":{"cta":"Follow for daily tips","handle":"@yourbrand"},"mood":"brand"}
  ],
  "caption": "Your Instagram caption here...",
  "hashtags": ["hashtag1","hashtag2","hashtag3"],
  "coverSceneIndex": 0
}

NEVER output scene objects as separate lines. NEVER output empty slots {} for text scenes (hook-text, text-over-media, quote-card, list-reveal, cta-card MUST have their slot keys filled).`

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

  const creatorBlock = customPrompt?.trim()
    ? `⚠️ CREATOR INSTRUCTIONS — these take absolute precedence over all guidelines below. Follow them exactly; let them shape the output above everything else:\n\n<creator_instructions>\n${customPrompt.trim()}\n</creator_instructions>\n\nAll sections below are subordinate to the above.\n\n---\n\n`
    : ''

  const systemPrompt = `${creatorBlock}You are a Senior Creative Director for short-form social media content.

BRAND VOICE:
${effectivePersona.systemPrompt}${strategyBlock}${principlesBlock}${templatePromptBlock}${contentSchemaBlock}

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

  return { creative, personaName: effectivePersona.name }
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
  const apiKey = provider === 'groq' ? groqKey : openaiKey
  if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY is not configured`)

  const llm: LLMClient = createLLMClient({ provider, apiKey })
  const result = await llm.parseCompletion({
    model,
    temperature: 0.7,
    messages,
    schema: CreativeDirectionSchema as any,
    schemaName: 'CreativeDirection',
    timeoutMs: provider === 'openai' ? 60_000 : 30_000,
  })
  return result.data as CreativeDirection
}
