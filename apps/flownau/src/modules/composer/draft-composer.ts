import { getClientForFeature } from '@nau/llm-client'
import { z } from 'zod'
import { prisma } from '@/modules/shared/prisma'
import { logError } from '@/modules/shared/logger'

// ─── Universal Drafter System Prompt ─────────────────────────────────────────
// Platform-level constant. Governs how any idea becomes a draft, regardless
// of format. The template injects format-specific schema and guidelines on top.

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftComposerInput {
  ideaText: string
  brandId: string
  templateId?: string   // if omitted, uses first enabled template for the format
  format?: string       // used to find template when templateId not given
  personaId?: string
  outputSchema: z.ZodTypeAny
  schemaName: string
}

export interface DraftComposerResult<T = unknown> {
  creative: T
  caption: string
  hashtags: string[]
  templateId: string | null
  personaId: string | null
}

// ─── Universal Draft Composer ─────────────────────────────────────────────────

export async function composeDraft<T = unknown>(
  input: DraftComposerInput,
): Promise<DraftComposerResult<T>> {
  const { ideaText, brandId, templateId, format, personaId, outputSchema, schemaName } = input

  // 1. Resolve persona
  const persona = personaId
    ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
    : ((await prisma.brandPersona.findFirst({ where: { brandId, isDefault: true } })) ??
      (await prisma.brandPersona.findFirst({ where: { brandId } })))

  // 2. Resolve template
  let template: { id: string; systemPrompt: string | null; contentSchema: unknown } | null = null
  if (templateId) {
    template = await prisma.template.findUnique({
      where: { id: templateId },
      select: { id: true, systemPrompt: true, contentSchema: true },
    })
  } else if (format) {
    const config = await prisma.brandTemplateConfig.findFirst({
      where: { brandId, enabled: true, template: { format } },
      include: { template: { select: { id: true, systemPrompt: true, contentSchema: true } } },
    })
    template = config?.template ?? null
  }

  // 3. Resolve brand language
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { language: true },
  })
  const language = brand?.language ?? 'Spanish'

  // 4. Assemble system prompt
  const sections: string[] = [UNIVERSAL_DRAFTER_PROMPT]

  if (persona?.systemPrompt) {
    sections.push(`\n---\n\n**BRAND VOICE**\n\n${persona.systemPrompt}`)
  }

  if (template?.systemPrompt) {
    sections.push(`\n---\n\n**TEMPLATE GUIDELINES**\n\n${template.systemPrompt}`)
  }

  if (template?.contentSchema) {
    sections.push(
      `\n**OUTPUT SCHEMA**\n\nProduce your output matching this structure exactly:\n\`\`\`json\n${JSON.stringify(template.contentSchema, null, 2)}\n\`\`\``,
    )
  }

  sections.push(`\n---\n\nLANGUAGE: Write the content in ${language}`)
  sections.push(`\nCREATE THE CONTENT ABOUT THIS TOPIC:`)

  const systemPrompt = sections.join('\n')

  // 5. Call LLM
  const { client: llm, model } = getClientForFeature('composition')

  let rawResult: unknown
  try {
    const result = await llm.parseCompletion({
      model,
      temperature: 0.65,
      schema: outputSchema as any,
      schemaName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: ideaText },
      ],
      timeoutMs: 40_000,
    })
    rawResult = result.data
  } catch (err) {
    logError('DRAFT_COMPOSER_LLM_ERROR', err)
    throw err
  }

  const creative = rawResult as T

  // Extract caption + hashtags from the creative (all schemas must include them)
  const c = creative as Record<string, unknown>
  const caption = typeof c.caption === 'string' ? c.caption : ''
  const hashtags = Array.isArray(c.hashtags) ? (c.hashtags as string[]) : []

  return {
    creative,
    caption,
    hashtags,
    templateId: template?.id ?? null,
    personaId: persona?.id ?? null,
  }
}
