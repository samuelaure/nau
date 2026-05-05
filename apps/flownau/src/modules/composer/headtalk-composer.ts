import { getClientForFeature } from '@nau/llm-client'
import { z } from 'zod'
import { prisma } from '@/modules/shared/prisma'
import { logError, logger } from '@/modules/shared/logger'
import { renderBrandContextBlock } from '@/modules/prompts/brand-context'
import type { LlmTrace } from '@/modules/ideation/ideation.service'

// ─── Universal Drafter System Prompt ─────────────────────────────────────────

const UNIVERSAL_DRAFTER_PROMPT = `You are a content creator who understands one fundamental truth about human attention: people do not stop scrolling for information — they stop for feeling.

Your job is to manufacture that feeling, then justify it.

---

**PSYCHOLOGICAL FOUNDATION**

Human decisions run on two systems. System 1 is fast, emotional, reflexive — it reacts before the brain consciously processes. System 2 is slow, rational, deliberate — it justifies what System 1 already decided.

Viral content wins System 1 in the first two seconds, then gives System 2 enough to feel good about sharing it. Every piece must work this way:

* Hook → activates System 1 through one of four triggers (see below)
* Body → satisfies System 2 with insight, proof, story resolution, or concrete value
* CTA → closes the loop the hook opened. Feels inevitable, not appended.

---

**THE FOUR HOOK TRIGGERS**

Every scroll-stopping hook runs on one of these. Know which one you're using before you write the first word.

1. **NOVELTY** — something the viewer has never seen framed this way.
   "The advice that made me 2X revenue was the one I almost ignored."

2. **TENSION** — an unresolved conflict or stakes that feel personal.
   "You're doing X right. It's still holding you back."

3. **IDENTITY SIGNAL** — content that lets them say something about who they are by sharing it.
   "This is for people who [specific belief they hold]."

4. **STATUS THREAT** — something that implies they're behind, missing something, or wrong.
   "Everyone doing X is making the same mistake."

The strongest hooks combine two. The weakest use none — they just announce a topic.

---

**VOICE**

Speak like the smartest person in the room who doesn't need anyone to know it. Confident without arrogance. Direct without coldness. Curious without performing curiosity.

You are talking to one specific person: someone who is already thinking about this topic, doesn't need it explained from zero, and will leave the moment they feel condescended to or sold at. They've heard the generic version. Give them the real one.

The test: does this sound like something a person would actually say, or like content?

---

**WHAT MAKES CONTENT SPREAD**

People share what makes them feel smart, seen, or right. Specifically:

* Content that says something they believe but couldn't articulate
* Content that challenges something they accepted without questioning it
* Content that gives them language for an experience they've already had

Engineer for this. Not for likes. Likes are a lagging indicator of resonance.

---

**CRAFT RULES**

**STRUCTURE:** One idea. One angle. One resolution. The piece is finished not when nothing can be added, but when nothing can be removed.

**LANGUAGE:** Short sentences. Active verbs. Concrete nouns. No qualifications in the hook — save nuance for the body. One clause per sentence. Split or cut the rest.

**SPECIFICITY:** "17%" beats "many". A named street beats "a city". A specific failure beats "struggle". Vagueness is the enemy of resonance.

**PERSPECTIVE:** Speak to one person. "You" not "people". "You probably think…" not "Many people think…". If the piece could be addressed to anyone, it will land for no one.

**HOOK:** Never open with "Today I want to talk about…", "In this video…", or the brand name. Win the reflex before the brain engages.

**CTA:** One action. Closes the loop the hook opened. Follow / save / comment [specific prompt] / visit [link]. The CTA is the natural end of the idea — not a request.

---

**NEVER**

* "Follow for more content like this" — generic, earns nothing
* "Hope this helps!" — closes with neediness
* Rhetorical questions the viewer can answer "no" to
* Disclaimers or caveats in the hook
* A confident tone wrapped around a generic idea — the voice doesn't save weak content. The idea has to work first.`

// ─── Output schema ────────────────────────────────────────────────────────────

export const HeadTalkCreativeSchema = z.object({
  hook: z.string().describe('Opening hook — max 2 sentences. Wins attention in the first 2 seconds.'),
  body: z.string().describe('Main content body — max 150 words. Short paragraphs, one idea each.'),
  cta: z.string().describe('Call to action — max 2 sentences. Closes the loop the hook opened.'),
  caption: z.string().describe('Social media caption for when the video is published.'),
  hashtags: z.array(z.string()).describe('8-12 relevant hashtags without # prefix.'),
})

export type HeadTalkCreative = z.infer<typeof HeadTalkCreativeSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeadTalkInput {
  ideaText: string
  brandId: string
  templateId?: string
}

export interface HeadTalkOutput {
  creative: HeadTalkCreative
  caption: string
  hashtags: string[]
  templateId: string | null
  trace: LlmTrace
}

// ─── Composer ─────────────────────────────────────────────────────────────────

export async function composeHeadTalk(input: HeadTalkInput): Promise<HeadTalkOutput> {
  const { ideaText, brandId, templateId } = input

  logger.info({ brandId, templateId }, '[HeadTalkComposer] Starting composition')

  // Resolve template
  let template: { id: string; systemPrompt: string | null; contentSchema: unknown } | null = null
  if (templateId) {
    template = await prisma.template.findUnique({
      where: { id: templateId },
      select: { id: true, systemPrompt: true, contentSchema: true },
    })
  } else {
    const config = await prisma.brandTemplateConfig.findFirst({
      where: { brandId, enabled: true, template: { format: 'head_talk' } },
      include: { template: { select: { id: true, systemPrompt: true, contentSchema: true } } },
    })
    template = config?.template ?? null
  }

  logger.info({ brandId, templateId: template?.id ?? null }, '[HeadTalkComposer] Resolved template')

  // Resolve brand language + context
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { language: true, name: true, context: true, draftCustomPrompt: true },
  })
  const language = brand?.language ?? 'Spanish'

  // Assemble system prompt
  const draftCustomBlock = brand?.draftCustomPrompt?.trim()
    ? `⚠️ DRAFT CUSTOM INSTRUCTIONS — campaign-level intent for drafting:\n\n<draft_custom>\n${brand.draftCustomPrompt.trim()}\n</draft_custom>\n\n---\n\n`
    : ''

  const renderedBrandContext = renderBrandContextBlock({
    name: brand?.name ?? null,
    context: brand?.context ?? null,
  })
  const brandContextBlock = renderedBrandContext
    ? `\n---\n\n**BRAND CONTEXT**\n${renderedBrandContext}\nCRITICAL: Never mention usernames, @handles, or social media account names in any output. Content is brand-level and platform-agnostic.`
    : `\n---\n\nCRITICAL: Never mention usernames, @handles, or social media account names in any output.`

  const sections: string[] = [`${draftCustomBlock}${UNIVERSAL_DRAFTER_PROMPT}`]
  sections.push(brandContextBlock)
  if (template?.systemPrompt) sections.push(`\n---\n\n**TEMPLATE GUIDELINES**\n\n${template.systemPrompt}`)
  if (template?.contentSchema) {
    sections.push(
      `\n**OUTPUT SCHEMA**\n\nProduce your output matching this structure exactly:\n\`\`\`json\n${JSON.stringify(template.contentSchema, null, 2)}\n\`\`\``,
    )
  }
  sections.push(`\n---\n\nLANGUAGE: Write the content in ${language}`)
  sections.push(`\nCREATE THE CONTENT ABOUT THIS TOPIC:`)

  const systemPrompt = sections.join('\n')

  // 6. Call LLM
  const { client: llm, model, registryId, provider } = getClientForFeature('composition')

  logger.info({ brandId, templateId: template?.id ?? null, provider, model }, '[HeadTalkComposer] Calling LLM')

  let rawResult: unknown
  try {
    const result = await llm.parseCompletion({
      model,
      temperature: 0.65,
      schema: HeadTalkCreativeSchema as any,
      schemaName: 'HeadTalkCreative',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: ideaText },
      ],
      timeoutMs: 40_000,
    })
    rawResult = result.data
    logger.info({ brandId, templateId: template?.id ?? null }, '[HeadTalkComposer] LLM response received successfully')
  } catch (err) {
    logError('[HeadTalkComposer] LLM call failed', err)
    throw err
  }

  const creative = rawResult as HeadTalkCreative
  const caption = typeof creative.caption === 'string' ? creative.caption : ''
  const hashtags = Array.isArray(creative.hashtags) ? creative.hashtags : []

  logger.info({ brandId, templateId: template?.id ?? null, captionLength: caption.length }, '[HeadTalkComposer] Composition complete')

  return {
    creative,
    caption,
    hashtags,
    templateId: template?.id ?? null,
    trace: { provider, model, registryId, systemPrompt, userMessage: ideaText, generatedAt: new Date().toISOString() },
  }
}
