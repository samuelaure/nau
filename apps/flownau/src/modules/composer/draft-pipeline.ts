import { getAdminModelClient } from '@/modules/shared/admin-model'
import { z } from 'zod'
import { prisma } from '@/modules/shared/prisma'
import { buildPrompt } from '@/modules/prompts/kernel'
import { renderBrandContextBlock } from '@/modules/prompts/brand-context'
import { logError, logger } from '@/modules/shared/logger'
import type { LlmTrace } from '@/modules/ideation/ideation.service'
import type { SlotDef } from '../../../prisma/seeds/templates'


const HEAD_TALK_FORMATS = new Set(['head_talk'])

const HeadTalkSchema = z.object({
  hook: z.string().describe('Opening hook — max 2 sentences. Wins attention in the first 2 seconds.'),
  body: z.string().describe('Main content body — max 150 words. Short paragraphs, one idea each.'),
  cta: z.string().describe('Call to action — max 2 sentences. Closes the loop the hook opened.'),
  caption: z.string().describe('Social media caption for when the video is published.'),
  hashtags: z.array(z.string()).describe('8-12 relevant hashtags without # prefix.'),
})

export type HeadTalkCreative = z.infer<typeof HeadTalkSchema>

export interface DraftPipelineInput {
  ideaText: string
  brandId: string
  templateId: string
  recentContext?: string | null
}

export interface DraftPipelineResult {
  creative: Record<string, unknown>
  caption: string
  hashtags: string[]
  brollMood?: string
  templateId: string
  format: string
  trace: LlmTrace
}

export async function runDraftPipeline(input: DraftPipelineInput): Promise<DraftPipelineResult> {
  const { ideaText, brandId, templateId, recentContext } = input

  logger.info({ brandId, templateId }, '[DraftPipeline] Starting composition')

  const [template, brand, brandTemplateConfig] = await Promise.all([
    prisma.template.findUnique({
      where: { id: templateId },
      select: { format: true, systemPrompt: true, slotSchema: true, schemaJson: true, contentSchema: true },
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

  if (!template) throw new Error(`Template ${templateId} not found`)

  const format = template.format ?? 'reel'
  const language = brand?.language ?? 'Spanish'

  const brandContextStr = renderBrandContextBlock({ name: brand?.name ?? null, context: brand?.context ?? null }) || null

  const slotOverrides = (brandTemplateConfig?.slotOverrides ?? null) as Record<string, { intention?: string; minWords?: number; maxWords?: number }> | null
  const mergedTemplate = slotOverrides ? { ...template, slotSchema: mergeSlotOverrides(template.slotSchema, slotOverrides) } : template

  const templateSchema = buildTemplateSchemaBlock(format, mergedTemplate)

  const { systemPrompt, layers } = buildPrompt({
    base: 'draft',
    brandContext: brandContextStr,
    customPrompt: brand?.draftCustomPrompt ?? null,
    templateSchema,
    templateCustomPrompt: template.systemPrompt ?? null,
    brandTemplatePrompt: brandTemplateConfig?.customPrompt ?? null,
    language,
  })

  const userMessage = buildUserMessage(ideaText, recentContext)

  logger.info({ brandId, templateId, format }, '[DraftPipeline] Prompt assembled')

  if (HEAD_TALK_FORMATS.has(format)) {
    return runHeadTalkPath({ brandId, templateId, format, systemPrompt, userMessage, ideaText, layers })
  }
  return runSlotPath({ brandId, templateId, format, systemPrompt, userMessage, template: mergedTemplate, ideaText, layers })
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
}): Promise<DraftPipelineResult> {
  const { brandId, templateId, format, systemPrompt, userMessage, layers } = args

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
  } catch (err) {
    logError('[DraftPipeline] HeadTalk LLM call failed', err)
    throw err
  }

  const creative = rawResult as HeadTalkCreative
  const caption = typeof creative.caption === 'string' ? creative.caption : ''
  const hashtags = Array.isArray(creative.hashtags) ? creative.hashtags : []

  logger.info({ brandId, templateId }, '[DraftPipeline] HeadTalk composition complete')

  return {
    creative: creative as unknown as Record<string, unknown>,
    caption,
    hashtags,
    templateId,
    format,
    trace: { provider, model, registryId, systemPrompt, userMessage, generatedAt: new Date().toISOString() },
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
}): Promise<DraftPipelineResult> {
  const { brandId, templateId, format, template, layers } = args
  let { systemPrompt, userMessage } = args

  if (!template.slotSchema) throw new Error(`Template ${templateId} has no slotSchema`)
  const slotDefs = template.slotSchema as unknown as SlotDef[]

  const { client: llm, model, registryId, provider } = await getAdminModelClient('drafting')

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  logger.info({ brandId, templateId, provider, model }, '[DraftPipeline] Slot LLM call')

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
  } catch (firstError: unknown) {
    const errorMsg = firstError instanceof Error ? firstError.message : String(firstError)
    logger.warn({ brandId, templateId, error: errorMsg }, '[DraftPipeline] Slot first attempt failed, retrying')
    messages.push({ role: 'user', content: 'Your previous response had invalid JSON. Fix it and return only a valid JSON object. No markdown, no explanation.' })
    try {
      parsed = await callAndParse()
    } catch (secondError: unknown) {
      logError('[DraftPipeline] Slot both attempts failed', secondError)
      throw new Error(`DraftPipeline slot path failed: ${secondError instanceof Error ? secondError.message : String(secondError)}`)
    }
  }

  let slots = (parsed.slots as Record<string, string> | undefined) ?? {}
  if (Object.keys(slots).length === 0) {
    for (const slotDef of slotDefs) {
      if (typeof parsed[slotDef.key] === 'string') slots[slotDef.key] = parsed[slotDef.key] as string
    }
  }

  const caption = (parsed.caption as string) ?? ''
  const hashtags = Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]) : []
  const brollMood = (parsed.brollMood as string) ?? ''

  logger.info({ brandId, templateId, slotKeys: Object.keys(slots), brollMood }, '[DraftPipeline] Slot composition complete')

  return {
    creative: { slots, caption, hashtags, brollMood },
    caption,
    hashtags,
    brollMood,
    templateId,
    format,
    trace: { provider, model, registryId, systemPrompt, userMessage, generatedAt: new Date().toISOString() },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTemplateSchemaBlock(format: string, template: { slotSchema: unknown; contentSchema: unknown; schemaJson: unknown }): string | null {
  if (template.slotSchema) {
    const slotDefs = template.slotSchema as unknown as SlotDef[]
    const isMultiSlot = slotDefs.length > 1

    const slotBlock = slotDefs
      .map((s) => {
        const wordRange = s.minWords != null ? `min ${s.minWords} words, max ${s.maxWords} words` : `max ${s.maxWords} words`
        return `• "${s.key}" (${s.label}) — ${wordRange}\n  Intention: ${s.intention}`
      })
      .join('\n\n')

    const multiSlotRule = isMultiSlot
      ? `\nMULTI-SLOT NARRATIVE RULE: These slots are shown sequentially. They must read as ONE continuous thought — write the complete arc first, then carve it into slots at natural break points.\n`
      : ''

    return `SLOTS TO FILL:\n${slotBlock}\n${multiSlotRule}\nAlso write:\n• caption — Instagram caption (max 300 chars, 2-3 sentences, no hashtags)\n• hashtags — 5–10 relevant hashtags (without # prefix)\n• brollMood — 1-2 mood/theme keywords for B-roll asset selection\n\nRespond ONLY with valid JSON matching the schema. Never mention @handles.`
  }

  if (template.contentSchema) {
    return `OUTPUT SCHEMA:\n\`\`\`json\n${JSON.stringify(template.contentSchema, null, 2)}\n\`\`\``
  }

  return null
}

function mergeSlotOverrides(
  slotSchema: unknown,
  overrides: Record<string, { intention?: string; minWords?: number; maxWords?: number }>,
): unknown {
  if (!Array.isArray(slotSchema)) return slotSchema
  return slotSchema.map((slot: SlotDef) => {
    const ov = overrides[slot.key]
    if (!ov) return slot
    return { ...slot, ...(ov.intention !== undefined && { intention: ov.intention }), ...(ov.minWords !== undefined && { minWords: ov.minWords }), ...(ov.maxWords !== undefined && { maxWords: ov.maxWords }) }
  })
}

function buildUserMessage(ideaText: string, recentContext?: string | null): string {
  let msg = `Create the content for this idea:\n\n${ideaText}`
  if (recentContext) msg += `\n\n${recentContext}`
  return msg
}
