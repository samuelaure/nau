import { getAdminModelClient } from '@/modules/shared/admin-model'
import { reportFlownauUsage } from '@/modules/shared/report-usage'
import { z } from 'zod'
import { prisma } from '@/modules/shared/prisma'
import { buildPrompt } from '@/modules/prompts/kernel'
import { renderBrandContextBlock } from '@/modules/prompts/brand-context'
import { logError, logger } from '@/modules/shared/logger'
import type { LlmTrace } from '@/modules/ideation/ideation.service'
import type { SlotDef } from '../../../prisma/seeds/templates'
import type { SceneDef, TextDef } from '@/types/template-scenes'

const HEAD_TALK_FORMATS = new Set(['head_talk', 'trial_head_talk'])

// ── HeadTalk — simplified 2-field schema ─────────────────────────────────────
const HeadTalkSchema = z.object({
  script: z
    .string()
    .describe(
      'Full spoken script — hook, body and call-to-action in one continuous flow. Short paragraphs, one idea each.',
    ),
  caption: z.string().describe('Social media caption for when the video is published.'),
  hashtags: z.array(z.string()).describe('8-12 relevant hashtags without # prefix.'),
})

export type HeadTalkCreative = z.infer<typeof HeadTalkSchema>

export interface DraftPipelineInput {
  ideaText: string
  brandId: string
  templateId: string
  recentContext?: string | null
  currentDraft?: { creative: Record<string, unknown>; caption: string } | null
  recomposeInstructions?: string | null
}

export interface DraftPipelineResult {
  creative: Record<string, unknown>
  caption: string
  hashtags: string[]
  brollMood?: string
  templateId: string
  format: string
  trace: LlmTrace
  postSynthesis: string
}

export async function runDraftPipeline(input: DraftPipelineInput): Promise<DraftPipelineResult> {
  const { ideaText, brandId, templateId, recentContext, currentDraft, recomposeInstructions } =
    input

  logger.info({ brandId, templateId }, '[DraftPipeline] Starting composition')

  const [templateRaw, brand, brandTemplateConfig] = await Promise.all([
    prisma.template.findUnique({
      where: { id: templateId },
    }),
    prisma.brand.findUnique({
      where: { id: brandId },
      select: { name: true, context: true, draftCustomPrompt: true, language: true },
    }),
    prisma.brandTemplateConfig.findUnique({
      where: { brandId_templateId: { brandId, templateId } },
      select: { customPrompt: true, slotOverrides: true },
    }),
  ])

  if (!templateRaw) throw new Error(`Template ${templateId} not found`)
  const template = templateRaw

  const format = template.format ?? 'reel'
  const language = brand?.language ?? 'Spanish'

  const brandContextStr =
    renderBrandContextBlock({ name: brand?.name ?? null, context: brand?.context ?? null }) || null

  const slotOverrides = (brandTemplateConfig?.slotOverrides ?? null) as Record<
    string,
    { intention?: string; minWords?: number; maxWords?: number; mode?: 'prompt' | 'manual'; manualText?: string }
  > | null
  const captionOverride = slotOverrides?.['caption'] ?? null
  const mergedTemplate = slotOverrides
    ? {
        ...template,
        slotSchema: mergeSlotOverrides(template.slotSchema, slotOverrides),
        contentSchema: mergeContentSchemaOverrides(template.contentSchema, slotOverrides),
      }
    : template

  const templateSchema = buildTemplateSchemaBlock(format, mergedTemplate, captionOverride, (template as any).scenes)

  const { systemPrompt, layers } = buildPrompt({
    base: 'draft',
    brandContext: brandContextStr,
    customPrompt: brand?.draftCustomPrompt ?? null,
    templateSchema,
    brandTemplatePrompt: brandTemplateConfig?.customPrompt ?? null,
    language,
  })

  const userMessage = buildUserMessage(ideaText, recentContext, currentDraft, recomposeInstructions)

  logger.info({ brandId, templateId, format }, '[DraftPipeline] Prompt assembled')

  if (HEAD_TALK_FORMATS.has(format)) {
    return runHeadTalkPath({
      brandId,
      templateId,
      format,
      systemPrompt,
      userMessage,
      ideaText,
      layers,
      language,
      captionOverride,
    })
  }

  // Block-based dynamic reel path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templateScenes = (template as any).scenes
  if (templateScenes && Array.isArray(templateScenes) && templateScenes.length > 0) {
    return runDynamicReelPath({
      brandId,
      templateId,
      format,
      systemPrompt,
      userMessage,
      scenes: templateScenes as SceneDef[],
      ideaText,
      layers,
      language,
      captionOverride,
    })
  }

  return runSlotPath({
    brandId,
    templateId,
    format,
    systemPrompt,
    userMessage,
    template: mergedTemplate,
    ideaText,
    layers,
    language,
    captionOverride,
  })
}

// ─── Head-talk path (structured output via parseCompletion) ───────────────────

async function runHeadTalkPath(args: {
  brandId: string
  templateId: string
  format: string
  systemPrompt: string
  userMessage: string
  ideaText: string
  layers: Record<string, string>
  language: string
  captionOverride: { mode?: 'prompt' | 'manual'; manualText?: string } | null
}): Promise<DraftPipelineResult> {
  const { brandId, templateId, format, systemPrompt, userMessage, layers, language, captionOverride } = args

  const { client: llm, model, registryId, provider } = await getAdminModelClient('drafting')

  logger.info({ brandId, templateId, provider, model }, '[DraftPipeline] HeadTalk LLM call')

  let rawResult: unknown
  try {
    const result = await llm.parseCompletion({
      model,
      temperature: 0.65,
      schema: HeadTalkSchema as any,
      schemaName: 'HeadTalkCreative',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      timeoutMs: 40_000,
    })
    rawResult = result.data
    reportFlownauUsage({ operation: 'draft_compose', brandId, usage: result.usage })
  } catch (err) {
    logError('[DraftPipeline] HeadTalk LLM call failed', err)
    throw err
  }

  const raw = rawResult as HeadTalkCreative
  const creative: HeadTalkCreative = {
    script: normalizeParagraphs(raw.script ?? ''),
    caption: normalizeParagraphs(raw.caption ?? ''),
    hashtags: raw.hashtags ?? [],
  }
  
  if (captionOverride?.mode === 'manual') {
    creative.caption = captionOverride.manualText || ''
  }

  const caption = creative.caption
  const hashtags = creative.hashtags

  const postSynthesis = await generateSynthesis(
    caption,
    creative as unknown as Record<string, unknown>,
    language,
  )

  logger.info({ brandId, templateId }, '[DraftPipeline] HeadTalk composition complete')

  return {
    creative: creative as unknown as Record<string, unknown>,
    caption,
    hashtags,
    templateId,
    format,
    postSynthesis,
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

// ─── Dynamic reel path (block-based templates) ────────────────────────────────

async function runDynamicReelPath(args: {
  brandId: string
  templateId: string
  format: string
  systemPrompt: string
  userMessage: string
  scenes: SceneDef[]
  ideaText: string
  layers: Record<string, string>
  language: string
  captionOverride: { mode?: 'prompt' | 'manual'; manualText?: string } | null
}): Promise<DraftPipelineResult> {
  const { brandId, templateId, format, scenes, layers, language, captionOverride } = args
  let { systemPrompt, userMessage } = args

  const { client: llm, model, registryId, provider } = await getAdminModelClient('drafting')

  // Build a flat key→instruction map for all prompt-mode texts
  // Key format: scene_{sceneIdx}_text_{textIdx}
  const promptSlots: Array<{ key: string; sceneIdx: number; textIdx: number; text: TextDef }> = []
  for (let si = 0; si < scenes.length; si++) {
    for (let ti = 0; ti < scenes[si].texts.length; ti++) {
      const text = scenes[si].texts[ti]
      if (text.mode === 'prompt') {
        promptSlots.push({ key: `scene_${si}_text_${ti}`, sceneIdx: si, textIdx: ti, text })
      }
    }
  }

  if (promptSlots.length === 0) {
    // All texts are manual — no LLM call needed, pass through verbatim
    const resolvedScenes = scenes.map((scene) => ({
      ...scene,
      texts: scene.texts.map((t) => ({ ...t, resolvedContent: t.content })),
    }))
    const caption = captionOverride?.mode === 'manual' ? captionOverride.manualText || '' : ''
    const hashtags: string[] = []
    const postSynthesis = await generateSynthesis(caption, { scenes: resolvedScenes }, language)
    return {
      creative: { scenes: resolvedScenes, caption, hashtags },
      caption,
      hashtags,
      templateId,
      format,
      postSynthesis,
      trace: {
        provider: 'none',
        model: 'none',
        registryId: 'none',
        systemPrompt,
        userMessage,
        generatedAt: new Date().toISOString(),
      },
    }
  }

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  logger.info({ brandId, templateId, provider, model, promptSlotCount: promptSlots.length }, '[DraftPipeline] DynamicReel LLM call')

  type ParseResult = { parsed: Record<string, unknown>; usage: import('@nau/llm-client').LLMUsage }
  const callAndParse = async (): Promise<ParseResult> => {
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
    return { parsed: JSON.parse(jsonStr.slice(start, end + 1)) as Record<string, unknown>, usage: result.usage }
  }

  let parsed: Record<string, unknown>
  try {
    const res = await callAndParse()
    parsed = res.parsed
    reportFlownauUsage({ operation: 'draft_compose', brandId, usage: res.usage })
  } catch (firstError) {
    logger.warn({ brandId, templateId }, '[DraftPipeline] DynamicReel first attempt failed, retrying')
    messages.push({ role: 'user', content: 'Your previous response had invalid JSON. Fix it and return only a valid JSON object. No markdown, no explanation.' })
    try {
      const res = await callAndParse()
      parsed = res.parsed
      reportFlownauUsage({ operation: 'draft_compose', brandId, usage: res.usage })
    } catch (secondError) {
      logError('[DraftPipeline] DynamicReel both attempts failed', secondError)
      throw new Error(`DraftPipeline DynamicReel path failed: ${secondError instanceof Error ? secondError.message : String(secondError)}`)
    }
  }

  // Map AI output back to scenes, merging manual texts verbatim
  const resolvedScenes = scenes.map((scene, si) => ({
    ...scene,
    texts: scene.texts.map((t, ti) => {
      if (t.mode === 'manual') return { ...t, resolvedContent: t.content }
      const key = `scene_${si}_text_${ti}`
      const aiContent = normalizeParagraphs((parsed[key] as string) ?? t.content)
      return { ...t, resolvedContent: aiContent }
    }),
  }))

  let caption = normalizeParagraphs((parsed.caption as string) ?? '')
  if (captionOverride?.mode === 'manual') {
    caption = captionOverride.manualText || ''
  }
  const hashtags = Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]) : []

  const postSynthesis = await generateSynthesis(caption, { scenes: resolvedScenes }, language)

  logger.info({ brandId, templateId, sceneCount: resolvedScenes.length }, '[DraftPipeline] DynamicReel composition complete')

  return {
    creative: { scenes: resolvedScenes, caption, hashtags },
    caption,
    hashtags,
    templateId,
    format,
    postSynthesis,
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

// ─── Slot-based path (chatCompletion + JSON parsing) ─────────────────────────

async function runSlotPath(args: {
  brandId: string
  templateId: string
  format: string
  systemPrompt: string
  userMessage: string
  template: { slotSchema: unknown }
  ideaText: string
  layers: Record<string, string>
  language: string
  captionOverride: { mode?: 'prompt' | 'manual'; manualText?: string } | null
}): Promise<DraftPipelineResult> {
  const { brandId, templateId, format, template, systemPrompt, userMessage, layers, language, captionOverride } = args

  if (!template.slotSchema) throw new Error(`Template ${templateId} has no slotSchema`)
  const slotDefs = template.slotSchema as unknown as SlotDef[]

  const { client: llm, model, registryId, provider } = await getAdminModelClient('drafting')

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  logger.info({ brandId, templateId, provider, model }, '[DraftPipeline] Slot LLM call')

  type SlotResult = { parsed: Record<string, unknown>; usage: import('@nau/llm-client').LLMUsage }
  const callAndParse = async (): Promise<SlotResult> => {
    const result = await llm.chatCompletion({
      model,
      temperature: 0.7,
      messages,
      timeoutMs: provider === 'openai' ? 60_000 : 45_000,
      maxTokens: 4096,
    })
    const raw = result.content?.trim() ?? ''
    const jsonStr = raw
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim()
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start === -1 || end <= start)
      throw new Error(`No JSON object in response: ${raw.slice(0, 200)}`)
    return {
      parsed: JSON.parse(jsonStr.slice(start, end + 1)) as Record<string, unknown>,
      usage: result.usage,
    }
  }

  let parsed: Record<string, unknown>
  try {
    const res = await callAndParse()
    parsed = res.parsed
    reportFlownauUsage({ operation: 'draft_compose', brandId, usage: res.usage })
  } catch (firstError: unknown) {
    const errorMsg = firstError instanceof Error ? firstError.message : String(firstError)
    logger.warn(
      { brandId, templateId, error: errorMsg },
      '[DraftPipeline] Slot first attempt failed, retrying',
    )
    messages.push({
      role: 'user',
      content:
        'Your previous response had invalid JSON. Fix it and return only a valid JSON object. No markdown, no explanation.',
    })
    try {
      const res = await callAndParse()
      parsed = res.parsed
      reportFlownauUsage({ operation: 'draft_compose', brandId, usage: res.usage })
    } catch (secondError: unknown) {
      logError('[DraftPipeline] Slot both attempts failed', secondError)
      throw new Error(
        `DraftPipeline slot path failed: ${secondError instanceof Error ? secondError.message : String(secondError)}`,
      )
    }
  }

  let slots = (parsed.slots as Record<string, string> | undefined) ?? {}
  if (Object.keys(slots).length === 0) {
    for (const slotDef of slotDefs) {
      if (typeof parsed[slotDef.key] === 'string')
        slots[slotDef.key] = parsed[slotDef.key] as string
    }
  }
  slots = Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, normalizeParagraphs(v)]))

  const caption = normalizeParagraphs((parsed.caption as string) ?? '')
  const hashtags = Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]) : []
  const brollMood = (parsed.brollMood as string) ?? ''

  const postSynthesis = await generateSynthesis(caption, { slots }, language)

  logger.info(
    { brandId, templateId, slotKeys: Object.keys(slots), brollMood },
    '[DraftPipeline] Slot composition complete',
  )

  return {
    creative: { slots, caption, hashtags, brollMood },
    caption,
    hashtags,
    brollMood,
    templateId,
    format,
    postSynthesis,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCaptionInstruction(
  override: { intention?: string; minWords?: number; maxWords?: number } | null,
): string {
  if (!override) return '• caption — Instagram caption (max 300 chars, 2-3 sentences, no hashtags)'
  const intention = override.intention ?? 'Instagram caption (2-3 sentences, no hashtags)'
  const wordRange =
    override.minWords != null
      ? `min ${override.minWords}, max ${override.maxWords ?? 60} words`
      : `max ${override.maxWords ?? 60} words`
  return `• caption — ${intention} (${wordRange})`
}

function buildTemplateSchemaBlock(
  format: string,
  template: { slotSchema: unknown; contentSchema: unknown; schemaJson: unknown },
  captionOverride: { intention?: string; minWords?: number; maxWords?: number } | null = null,
  scenes?: unknown,
): string | null {
  // Block-based DynamicReel: derive schema from prompt-mode text slots across scenes
  if (scenes && Array.isArray(scenes) && scenes.length > 0) {
    const typedScenes = scenes as SceneDef[]
    const promptSlots: Array<{ key: string; text: TextDef }> = []
    for (let si = 0; si < typedScenes.length; si++) {
      for (let ti = 0; ti < typedScenes[si].texts.length; ti++) {
        const text = typedScenes[si].texts[ti]
        if (text.mode === 'prompt') {
          promptSlots.push({ key: `scene_${si}_text_${ti}`, text })
        }
      }
    }
    if (promptSlots.length === 0) return null
    const slotInstructions = promptSlots
      .map((s) => {
        const wordRange =
          s.text.minWords != null
            ? `min ${s.text.minWords} words, max ${s.text.maxWords ?? 60} words`
            : `max ${s.text.maxWords ?? 60} words`
        return `• "${s.key}" — ${wordRange}\n  Instructions: ${s.text.content}`
      })
      .join('\n\n')
    const captionLine = buildCaptionInstruction(captionOverride)
    return `SCENE TEXT SLOTS TO FILL:\n${slotInstructions}\n\nAlso write:\n${captionLine}\n• hashtags — 5–10 relevant hashtags (without # prefix)\n\nRespond ONLY with valid JSON. Never mention @handles.`
  }

  if (template.slotSchema) {
    const slotDefs = template.slotSchema as unknown as SlotDef[]
    const isMultiSlot = slotDefs.length > 1

    const slotBlock = slotDefs
      .map((s) => {
        const wordRange =
          s.minWords != null
            ? `min ${s.minWords} words, max ${s.maxWords} words`
            : `max ${s.maxWords} words`
        return `• "${s.key}" (${s.label}) — ${wordRange}\n  Intention: ${s.intention}`
      })
      .join('\n\n')

    const multiSlotRule = isMultiSlot
      ? `\nMULTI-SLOT NARRATIVE RULE: These slots are shown sequentially. They must read as ONE continuous thought — write the complete arc first, then carve it into slots at natural break points.\n`
      : ''

    const captionLine = buildCaptionInstruction(captionOverride)

    return `SLOTS TO FILL:\n${slotBlock}\n${multiSlotRule}\nAlso write:\n${captionLine}\n• hashtags — 5–10 relevant hashtags (without # prefix)\n• brollMood — 1-2 mood/theme keywords for B-roll asset selection\n\nRespond ONLY with valid JSON matching the schema. Never mention @handles.`
  }

  if (template.contentSchema) {
    let block = `OUTPUT SCHEMA:\n\`\`\`json\n${JSON.stringify(template.contentSchema, null, 2)}\n\`\`\``
    if (captionOverride) {
      const captionNote = buildCaptionInstruction(captionOverride).replace('• caption — ', '')
      block += `\n\nCaption requirement: ${captionNote}`
    }
    return block
  }

  return null
}

function mergeContentSchemaOverrides(
  contentSchema: unknown,
  overrides: Record<string, { intention?: string; minWords?: number; maxWords?: number }>,
): unknown {
  if (!contentSchema || typeof contentSchema !== 'object') return contentSchema
  const cs = contentSchema as Record<string, unknown>
  if (!Array.isArray(cs.sections)) return contentSchema
  return {
    ...cs,
    sections: (
      cs.sections as Array<{ key: string; intention: string; minWords?: number; maxWords: number }>
    ).map((s) => {
      const ov = overrides[s.key]
      if (!ov) return s
      return {
        ...s,
        ...(ov.intention !== undefined && { intention: ov.intention }),
        ...(ov.minWords !== undefined && { minWords: ov.minWords }),
        ...(ov.maxWords !== undefined && { maxWords: ov.maxWords }),
      }
    }),
  }
}

function mergeSlotOverrides(
  slotSchema: unknown,
  overrides: Record<string, { intention?: string; minWords?: number; maxWords?: number }>,
): unknown {
  if (!Array.isArray(slotSchema)) return slotSchema
  return slotSchema.map((slot: SlotDef) => {
    const ov = overrides[slot.key]
    if (!ov) return slot
    return {
      ...slot,
      ...(ov.intention !== undefined && { intention: ov.intention }),
      ...(ov.minWords !== undefined && { minWords: ov.minWords }),
      ...(ov.maxWords !== undefined && { maxWords: ov.maxWords }),
    }
  })
}

async function generateSynthesis(
  caption: string,
  creative: Record<string, unknown>,
  language: string,
): Promise<string> {
  const { client: llm, model } = await getAdminModelClient('drafting')
  const slots = (creative as { slots?: Record<string, string> }).slots
  const contentSample = slots
    ? Object.values(slots).join(' ').slice(0, 600)
    : Object.values(creative)
        .filter((v) => typeof v === 'string')
        .join(' ')
        .slice(0, 600)

  try {
    const result = await llm.chatCompletion({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are an intelligence analyst. Given social media post content, write a concise 1-2 sentence synthesis describing the main topic, key insights, and content themes. Write all output in ${language}. No preamble.`,
        },
        { role: 'user', content: `Caption: ${caption}\n\nContent: ${contentSample}` },
      ],
      timeoutMs: 15_000,
      maxTokens: 200,
    })
    return result.content?.trim() ?? ''
  } catch {
    return ''
  }
}

/**
 * Splits every sentence in `text` onto its own paragraph (separated by \n\n).
 * Sentence boundaries are detected at . ? ! followed by whitespace.
 * Trailing periods are removed; ? and ! are preserved on their sentence.
 * Intra-block single newlines are collapsed to a single space first,
 * so the input format doesn't matter.
 */
function normalizeParagraphs(text: string): string {
  const sentences: string[] = []

  for (const block of text.split(/\n{2,}/)) {
    // Flatten any single newlines inside the block into spaces
    const flat = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ')
      .trim()

    if (!flat) continue

    const parts: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < flat.length; i++) {
      const char = flat[i]
      
      if (char === '"' || char === '“' || char === '”' || char === '«' || char === '»') {
        inQuotes = !inQuotes
      }
      
      current += char

      // Split at sentence boundaries only if outside quotes
      if (!inQuotes && (char === '.' || char === '?' || char === '!')) {
        const nextChar = flat[i + 1]
        if (nextChar === ' ' || nextChar === undefined) {
          parts.push(current.trim().replace(/\.$/, '')) // strip trailing period only
          current = ""
          // Skip trailing spaces
          while (flat[i + 1] === ' ') i++
        }
      }
    }

    if (current.trim()) {
      parts.push(current.trim().replace(/\.$/, ''))
    }

    sentences.push(...parts.filter(Boolean))
  }

  return sentences.join('\n\n')
}

function buildUserMessage(
  ideaText: string,
  recentContext?: string | null,
  currentDraft?: { creative: Record<string, unknown>; caption: string } | null,
  recomposeInstructions?: string | null,
): string {
  let msg = `Create the content for this idea:\n\n${ideaText}`
  if (recentContext) msg += `\n\n${recentContext}`
  if (currentDraft) {
    const slots = (currentDraft.creative as { slots?: Record<string, string> }).slots
    const draftSummary =
      slots && Object.keys(slots).length > 0
        ? Object.entries(slots)
            .map(([k, v]) => `[${k}]: ${v}`)
            .join('\n')
        : currentDraft.caption
    msg += `\n\n--- RECOMPOSE REQUEST ---\nThe user wants a fresh recompose. Below is what was already generated — do NOT repeat the same structure, phrasing, or angle:\n\n${draftSummary}`
    if (currentDraft.caption) msg += `\n\nCaption: ${currentDraft.caption}`
    const instruction = recomposeInstructions?.trim()
    msg += instruction
      ? `\n\nThe user specifically wants: ${instruction}`
      : '\n\nGenerate a meaningfully different take — different hook angle, different flow, different phrasing.'
  }
  return msg
}
