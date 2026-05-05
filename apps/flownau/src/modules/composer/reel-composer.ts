import { createLLMClient } from '@nau/llm-client'
import type { LlmTrace } from '@/modules/ideation/ideation.service'
import { prisma } from '@/modules/shared/prisma'
import { resolveModelId } from '@/modules/composer/model-resolver'
import { getSetting } from '@/modules/shared/settings'
import { logError, logger } from '@/modules/shared/logger'
import { renderBrandContextBlock } from '@/modules/prompts/brand-context'
import type { SlotDef } from '../../../prisma/seeds/templates'

const DEFAULT_MODEL_SELECTION = 'GROQ_LLAMA_3_3' as const

export interface ReelComposerInput {
  ideaText: string
  brandId: string
  templateId: string
}

export interface ReelComposerResult {
  slots: Record<string, string>
  caption: string
  hashtags: string[]
  brollMood: string
  trace: LlmTrace
}

export async function composeReel(input: ReelComposerInput): Promise<ReelComposerResult> {
  const { ideaText, brandId, templateId } = input

  logger.info({ brandId, templateId }, '[ReelComposer] Starting composition')

  const [template, brandData] = await Promise.all([
    prisma.template.findUnique({
      where: { id: templateId },
      select: { systemPrompt: true, slotSchema: true, schemaJson: true },
    }),
    prisma.brand.findUnique({
      where: { id: brandId },
      select: { name: true, context: true, draftCustomPrompt: true, language: true },
    }),
  ])

  if (!template) throw new Error(`Template ${templateId} not found`)
  if (!template.slotSchema) throw new Error(`Template ${templateId} has no slotSchema`)

  const slotDefs = template.slotSchema as unknown as SlotDef[]

  logger.info({ brandId, templateId, slots: slotDefs.map((s) => s.key) }, '[ReelComposer] Resolved template')

  const { provider, model, registryId } = resolveModelId(DEFAULT_MODEL_SELECTION)
  const groqKey = (await getSetting('groq_api_key')) ?? process.env.GROQ_API_KEY ?? null
  const openaiKey = (await getSetting('openai_api_key')) ?? process.env.OPENAI_API_KEY ?? null

  const language = brandData?.language ?? 'Spanish'

  const brandBlock = renderBrandContextBlock({
    name: brandData?.name ?? null,
    context: brandData?.context ?? null,
  })

  const slotBlock = slotDefs
    .map((s) => {
      const wordRange = s.minWords != null
        ? `min ${s.minWords} words, max ${s.maxWords} words`
        : `max ${s.maxWords} words`
      return `• "${s.key}" (${s.label}) — ${wordRange}\n  Intention: ${s.intention}`
    })
    .join('\n\n')

  const isMultiSlot = slotDefs.length > 1

  const draftCustomBlock = brandData?.draftCustomPrompt?.trim()
    ? `⚠️ DRAFT CUSTOM INSTRUCTIONS — campaign-level intent for drafting:\n<draft_custom>\n${brandData.draftCustomPrompt.trim()}\n</draft_custom>\n\n`
    : ''

  const systemPrompt = `${draftCustomBlock}${template.systemPrompt ?? ''}
${brandBlock}
LANGUAGE: Write ALL text in ${language}.

SLOTS TO FILL:
${slotBlock}

Also write:
• caption — Instagram caption (max 300 chars, 2-3 sentences, no hashtags in caption)
• hashtags — 5–10 relevant hashtags (without # prefix)
• brollMood — 1-2 mood/theme keywords for B-roll asset selection (e.g. "family, nature", "urban, focus")

HOOK QUALITY RULES (applies to any opening/hook slot):
- The hook MUST reference the specific topic of this idea — not a generic question
- A viewer should be able to understand the subject from the hook alone, even with no other context
- Bad: "¿Límites diferentes?" (generic, tells the viewer nothing)
- Good: "Tu hijo no es difícil — tiene un tipo energético diferente" (specific, intriguing, self-contained)
- Use tension, a surprising reframe, or a bold claim rooted in the content — never a vague teaser

${isMultiSlot ? `MULTI-SLOT NARRATIVE RULE (critical for this template):
- These slots are shown sequentially on screen — the viewer reads them one after another
- They must read as ONE continuous thought, not separate independent sentences
- Write the complete arc first, then carve it into slots at the natural break points
- Test: if you read all slots back-to-back aloud, they must flow as a single coherent statement
- WRONG: text1="No te esfuerces tanto" / text2="El descanso también es productivo" (two separate ideas)
- RIGHT: text1="El problema no es que trabajas poco" / text2="es que no descansas lo suficiente para trabajar bien" (one split thought)

` : ''}CRITICAL:
- Respect word limits exactly — count every word, stay within min–max range for each slot
- For slots with a minimum: write enough to fill the intent; a slot at half its minimum is a failure
- Never mention usernames or @handles
- Respond ONLY with valid JSON matching the schema`

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Fill the slots for this content idea:\n\n${ideaText}` },
  ]

  const apiKey = provider === 'groq' ? groqKey : openaiKey
  if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY is not configured`)

  const llm = createLLMClient({ provider, apiKey })

  logger.info({ brandId, templateId, provider, model }, '[ReelComposer] Calling LLM')

  const callAndParse = async (): Promise<Record<string, unknown>> => {
    const result = await llm.chatCompletion({
      model,
      temperature: 0.7,
      messages,
      timeoutMs: provider === 'openai' ? 60_000 : 45_000,
      maxTokens: 4096,
    })
    const raw = result.content?.trim() ?? ''
    const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error(`No JSON object in response: ${raw.slice(0, 200)}`)
    return JSON.parse(jsonStr.slice(start, end + 1)) as Record<string, unknown>
  }

  let parsed: Record<string, unknown>
  try {
    parsed = await callAndParse()
    logger.info({ brandId, templateId }, '[ReelComposer] LLM response parsed successfully')
  } catch (firstError: unknown) {
    const errorMsg = firstError instanceof Error ? firstError.message : String(firstError)
    logger.warn({ brandId, templateId, error: errorMsg }, '[ReelComposer] First attempt failed, retrying')
    messages.push({
      role: 'user',
      content: `Your previous response had invalid JSON. Fix it and return only a valid JSON object. No markdown, no explanation.`,
    })
    try {
      parsed = await callAndParse()
      logger.info({ brandId, templateId }, '[ReelComposer] Retry succeeded')
    } catch (secondError: unknown) {
      logError('[ReelComposer] Both attempts failed', secondError)
      throw new Error(`ReelComposer failed: ${secondError instanceof Error ? secondError.message : String(secondError)}`)
    }
  }

  let slots = (parsed.slots as Record<string, string> | undefined) ?? {}
  if (Object.keys(slots).length === 0) {
    for (const slotDef of slotDefs) {
      if (typeof parsed[slotDef.key] === 'string') {
        slots[slotDef.key] = parsed[slotDef.key] as string
      }
    }
  }

  logger.info({ brandId, templateId, slotKeys: Object.keys(slots), brollMood: parsed.brollMood }, '[ReelComposer] Composition complete')

  return {
    slots,
    caption: (parsed.caption as string) ?? '',
    hashtags: Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]) : [],
    brollMood: (parsed.brollMood as string) ?? '',
    trace: {
      provider,
      model,
      registryId,
      systemPrompt,
      userMessage: messages[1]?.content ?? '',
      generatedAt: new Date().toISOString(),
    },
  }
}
