import type { PrismaClient } from '@prisma/client'

/**
 * System template definitions — available to all brands.
 *
 * scope = "system"  → shared platform templates, brandId = "system"
 * scope = "brand"   → custom templates tied to a specific brand (future)
 *
 * Brands activate/deactivate templates via BrandTemplateConfig.
 */

interface TemplateDefinition {
  name: string
  format: string
  remotionId: string
  sceneType: string
  scope: string
  systemPrompt: string
  contentSchema: object
  schemaJson?: object
}

// ─── SYSTEM TEMPLATES ─────────────────────────────────────────────────────────

export const SYSTEM_TEMPLATES: TemplateDefinition[] = [

  // ─── Head Talk: Hook-First ────────────────────────────────────────────────
  {
    name: 'Head Talk — Hook First',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    systemPrompt: `You are a content creator who understands one fundamental truth about human attention: people do not stop scrolling for feeling — they stop for feeling.

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
* A confident tone wrapped around a generic idea — the voice doesn't save weak content. The idea has to work first.`,

    contentSchema: {
      format: 'head_talk',
      structure: 'hook → tension/body → cta',
      sections: [
        {
          key: 'hook',
          label: 'Hook',
          guidance:
            'The first sentence spoken on camera. Wins System 1 in 2 seconds. Use one of the four triggers: NOVELTY, TENSION, IDENTITY SIGNAL, or STATUS THREAT. Never start with "Today I want to talk about". Max 2 sentences.',
          maxWords: 30,
        },
        {
          key: 'body',
          label: 'Body',
          guidance:
            'Delivers on the hook. Short paragraphs — one idea each. Concrete, specific, no filler. Use numbers, named examples, and real specifics. This satisfies System 2. Max 150 words.',
          maxWords: 150,
        },
        {
          key: 'cta',
          label: 'Call to Action',
          guidance:
            'One action. Closes the loop the hook opened. Feels like a natural ending, not an appended request. Max 2 sentences.',
          maxWords: 25,
        },
      ],
      captionStyle:
        'Mirror the hook as the opening line. Expand with 2-3 value sentences. End with a comment prompt or save nudge. Keep it tight — captions are read by people who already stopped.',
      hashtagCount: '8-12 targeted hashtags — specific niche first, broad topic last',
    },

    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Opening hook — max 2 sentences' },
        body: { type: 'string', description: 'Main content body — max 150 words' },
        cta: { type: 'string', description: 'Call to action — max 2 sentences' },
        caption: { type: 'string', description: 'Social media caption for publishing' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags without # prefix' },
      },
    },
  },

  // ─── Reel: Hook & Value ───────────────────────────────────────────────────
  {
    name: 'Reel — Hook & Value',
    format: 'reel',
    remotionId: 'standard-reel',
    sceneType: 'reel',
    scope: 'system',
    systemPrompt: `Use a hook-first structure: open with a single punchy question or bold statement (hook-text scene), follow with 2-3 text-over-media scenes each delivering one concrete insight, and close with a direct CTA. Every scene must earn its place — cut anything that doesn't add value. B-roll should feel aspirational and relevant to the brand's world. Aim for 4-5 scenes total. Keep the pacing tight: the viewer should feel they got real value in under 20 seconds.`,
    contentSchema: {
      format: 'reel',
      totalScenes: '4-5',
      structure: [
        {
          position: 1,
          type: 'hook-text',
          purpose: 'Grab attention immediately',
          guidance:
            'One punchy line — a provocative question, surprising fact, or bold statement. No fluff. Max 80 chars.',
        },
        {
          position: 2,
          type: 'text-over-media',
          purpose: 'Establish the problem or context',
          guidance:
            'Set up why this matters. One clear, specific sentence. B-roll mood: relevant to brand world. Max 150 chars.',
        },
        {
          position: 3,
          type: 'text-over-media',
          purpose: 'Deliver the core value or solution',
          guidance: 'The main insight or key takeaway. Concrete and actionable — not vague. Max 150 chars.',
        },
        {
          position: '4 (optional)',
          type: 'text-over-media',
          purpose: 'Add a supporting point or proof',
          guidance:
            'A second value point, stat, or example that reinforces scene 3. Skip if the idea is tight enough without it. Max 150 chars.',
        },
        {
          position: 'last',
          type: 'cta-card',
          purpose: 'Convert attention into action',
          guidance:
            'One direct verb-led action: "Save this", "Follow for more", "DM us [word]". Never two CTAs in one. Max 60 chars.',
        },
      ],
      captionStyle:
        'Short hook sentence + 3-4 value bullets + one-line CTA. Line breaks between sections.',
      hashtagCount: '8-12 targeted hashtags — niche first, then broad',
    },
  },

]

// ─── SEED FUNCTIONS ───────────────────────────────────────────────────────────

/**
 * Seeds system-scoped platform templates (brandId = "system").
 * These are available to all brands via BrandTemplateConfig.
 * Safe to re-run — upserts on (name, scope).
 */
// Names of system templates that have been removed — delete them on next seed run
const REMOVED_TEMPLATE_NAMES = ['Reel — Storytelling Arc']

export async function seedSystemTemplates(prisma: PrismaClient): Promise<void> {
  // Remove any retired system templates
  for (const name of REMOVED_TEMPLATE_NAMES) {
    const stale = await prisma.template.findFirst({ where: { name, scope: 'system' } })
    if (stale) {
      await prisma.brandTemplateConfig.deleteMany({ where: { templateId: stale.id } })
      await prisma.template.delete({ where: { id: stale.id } })
      console.log(`  ✗ Removed retired system template: "${name}"`)
    }
  }

  for (const t of SYSTEM_TEMPLATES) {
    await prisma.template.upsert({
      where: {
        // use name+scope as logical unique key via findFirst + create/update pattern
        // since there's no unique constraint on those fields, we use id from findFirst
        id: (await prisma.template.findFirst({ where: { name: t.name, scope: 'system' } }))?.id ?? 'noop',
      },
      create: {
        brandId: null,
        name: t.name,
        format: t.format,
        remotionId: t.remotionId,
        sceneType: t.sceneType,
        scope: 'system',
        systemPrompt: t.systemPrompt,
        contentSchema: t.contentSchema,
        schemaJson: t.schemaJson ?? undefined,
        useBrandAssets: false,
      },
      update: {
        systemPrompt: t.systemPrompt,
        contentSchema: t.contentSchema,
        schemaJson: t.schemaJson ?? undefined,
        format: t.format,
      },
    })
    console.log(`  ✓ Seeded system template: "${t.name}" (${t.format})`)
  }
}

/**
 * Seeds brand-scoped templates for a given brand (legacy / brand-custom).
 * @deprecated — prefer seedSystemTemplates. Kept for backward compat.
 */
export async function seedTemplatesForBrand(prisma: PrismaClient, brandId: string): Promise<void> {
  // Activate all system templates for this brand
  const systemTemplates = await prisma.template.findMany({ where: { scope: 'system' } })
  for (const t of systemTemplates) {
    await prisma.brandTemplateConfig.upsert({
      where: { brandId_templateId: { brandId, templateId: t.id } },
      create: { brandId, templateId: t.id, enabled: true },
      update: {},
    })
    console.log(`  ✓ Activated system template "${t.name}" for brand ${brandId}`)
  }
}
