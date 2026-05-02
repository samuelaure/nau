import { createLLMClient } from '@nau/llm-client'
import type { LlmTrace } from '@/modules/ideation/ideation.service'
import { prisma } from '@/modules/shared/prisma'
import { resolveModelId } from '@/modules/composer/model-resolver'
import { getSetting } from '@/modules/shared/settings'
import { logError, logger } from '@/modules/shared/logger'
import type { SlotDef } from '../../../prisma/seeds/templates'

const PLATFORM_DEFAULT_PERSONA = {
  name: 'Platform Default',
  systemPrompt: `You are a versatile, professional content creator. Communicate clearly and engagingly. Confident without arrogance. Direct without coldness.`,
  modelSelection: 'GROQ_LLAMA_3_3' as const,
}

export interface SlotComposerInput {
  ideaText: string
  brandId: string
  templateId: string
  personaId?: string
  customPrompt?: string | null
}

export interface SlotComposerResult {
  slots: Record<string, string>
  caption: string
  hashtags: string[]
  brollMood: string
  personaName: string
  trace: LlmTrace
}

/**
 * SlotComposer — fills the fixed text slots defined in a template's slotSchema.
 *
 * Replaces scene-composer for reel templates. The AI's only job is to write
 * the right text for each slot — layout, timing, and visuals are fixed in the
 * Remotion component.
 */
export async function composeSlots(input: SlotComposerInput): Promise<SlotComposerResult> {
  const { ideaText, brandId, templateId, personaId, customPrompt } = input

  const [persona, template, brandData] = await Promise.all([
    personaId
      ? prisma.brandPersona.findUnique({ where: { id: personaId } })
      : prisma.brandPersona
          .findFirst({ where: { brandId, isDefault: true } })
          .then((p) => p ?? prisma.brandPersona.findFirst({ where: { brandId } })),
    prisma.template.findUnique({
      where: { id: templateId },
      select: { systemPrompt: true, slotSchema: true, schemaJson: true },
    }),
    prisma.brand.findUnique({
      where: { id: brandId },
      select: { name: true, ideationPrompt: true, language: true },
    }),
  ])

  if (!template) throw new Error(`Template ${templateId} not found`)
  if (!template.slotSchema) throw new Error(`Template ${templateId} has no slotSchema`)

  const slotDefs = template.slotSchema as unknown as SlotDef[]
  const effectivePersona = persona ?? PLATFORM_DEFAULT_PERSONA

  // Resolve model
  const { provider, model, registryId } = resolveModelId(effectivePersona.modelSelection)
  const groqKey = (await getSetting('groq_api_key')) ?? process.env.GROQ_API_KEY ?? null
  const openaiKey = (await getSetting('openai_api_key')) ?? process.env.OPENAI_API_KEY ?? null

  const language = brandData?.language ?? 'Spanish'

  // Brand context
  const brandLines: string[] = []
  if (brandData?.name) brandLines.push(`Brand: ${brandData.name}`)
  if (brandData?.ideationPrompt?.trim()) brandLines.push(`Niche & style: ${brandData.ideationPrompt.trim()}`)
  const brandBlock = brandLines.length > 0 ? `\nBRAND CONTEXT:\n${brandLines.join('\n')}\n` : ''

  // Slot spec block
  const slotBlock = slotDefs
    .map(
      (s) =>
        `• "${s.key}" (${s.label}) — max ${s.maxWords} words\n  Intention: ${s.intention}`,
    )
    .join('\n\n')

  const creatorBlock = customPrompt?.trim()
    ? `⚠️ CREATOR INSTRUCTIONS — absolute priority:\n<creator_instructions>\n${customPrompt.trim()}\n</creator_instructions>\n\n---\n\n`
    : ''

  const systemPrompt = `${creatorBlock}${template.systemPrompt ?? ''}
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

CRITICAL:
- Respect word limits exactly (count carefully)
- Each slot must be a COMPLETE, STANDALONE sentence or phrase — never split one sentence across two slots
- Never mention usernames or @handles
- Respond ONLY with valid JSON matching the schema`

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Fill the slots for this content idea:\n\n${ideaText}` },
  ]

  const apiKey = provider === 'groq' ? groqKey : openaiKey
  if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY is not configured`)

  const llm = createLLMClient({ provider, apiKey })

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
    // Extract first {...} block
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error(`No JSON object in response: ${raw.slice(0, 200)}`)
    return JSON.parse(jsonStr.slice(start, end + 1)) as Record<string, unknown>
  }

  let parsed: Record<string, unknown>
  try {
    parsed = await callAndParse()
  } catch (firstError: unknown) {
    const errorMsg = firstError instanceof Error ? firstError.message : String(firstError)
    logger.warn(`[SlotComposer] First attempt failed, retrying: ${errorMsg}`)
    messages.push({
      role: 'user',
      content: `Your previous response had invalid JSON. Fix it and return only a valid JSON object. No markdown, no explanation.`,
    })
    try {
      parsed = await callAndParse()
    } catch (secondError: unknown) {
      logError(`[SlotComposer] Both attempts failed for idea: ${ideaText.slice(0, 100)}`, secondError)
      throw new Error(`SlotComposer failed: ${secondError instanceof Error ? secondError.message : String(secondError)}`)
    }
  }

  // Normalize: Groq often flattens slots to root level instead of nesting under "slots"
  let slots = (parsed.slots as Record<string, string> | undefined) ?? {}
  if (Object.keys(slots).length === 0) {
    // Collect slot keys from slotDefs that appear at root level
    for (const slotDef of slotDefs) {
      if (typeof parsed[slotDef.key] === 'string') {
        slots[slotDef.key] = parsed[slotDef.key] as string
      }
    }
  }

  return {
    slots,
    caption: (parsed.caption as string) ?? '',
    hashtags: Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]) : [],
    brollMood: (parsed.brollMood as string) ?? '',
    personaName: effectivePersona.name,
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
