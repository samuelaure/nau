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

  // ─── Reel: Hook & Value (single short text) ──────────────────────────────
  {
    name: 'Reel — Hook & Value',
    format: 'reel',
    remotionId: 'standard-reel',
    sceneType: 'reel',
    scope: 'system',
    systemPrompt: `Use a hook-first structure: open with a single punchy question or bold statement (hook-text scene), follow with 1-2 text-over-media scenes each delivering one concrete insight, and close with a direct CTA. Aim for 3-4 scenes total — ultra-tight pacing. Every word earns its place. The viewer should feel they got a complete, satisfying idea in under 10 seconds.`,
    contentSchema: {
      format: 'reel',
      totalScenes: '3-4',
      structure: [
        {
          position: 1,
          type: 'hook-text',
          purpose: 'Stop the scroll instantly',
          guidance: 'One punchy line — question, shocking fact, or bold statement. Max 60 chars. No fluff.',
        },
        {
          position: 2,
          type: 'text-over-media',
          purpose: 'Deliver the single core insight',
          guidance: 'The whole value in one sentence. Concrete, specific, no padding. Max 120 chars.',
        },
        {
          position: 'last',
          type: 'cta-card',
          purpose: 'Convert to action',
          guidance: 'One verb-led CTA: "Save this", "Follow for more". Max 50 chars.',
        },
      ],
      captionStyle: 'One punchy hook line + 2-3 value sentences + one CTA. No filler.',
      hashtagCount: '6-10 targeted hashtags — niche first',
    },
  },

  // ─── Reel: Long Form Value ────────────────────────────────────────────────
  {
    name: 'Reel — Long Form Value',
    format: 'reel',
    remotionId: 'standard-reel',
    sceneType: 'reel',
    scope: 'system',
    systemPrompt: `Write a longer, denser reel: hook-text to grab attention, then 4-5 text-over-media scenes each carrying a complete idea or step, one media-only for breathing room, and a cta-card to close. Total 6-7 scenes. The viewer should feel they've watched a mini-lesson. Each text scene should contain a full, substantive sentence — not a fragment. Pacing is deliberate, not rushed.`,
    contentSchema: {
      format: 'reel',
      totalScenes: '6-7',
      structure: [
        { position: 1, type: 'hook-text', purpose: 'Establish the big promise', guidance: 'Bold statement or question that promises specific value. Max 80 chars.' },
        { position: 2, type: 'text-over-media', purpose: 'Point 1', guidance: 'First full insight or step. Complete sentence. Max 150 chars.' },
        { position: 3, type: 'text-over-media', purpose: 'Point 2', guidance: 'Second insight or step. Complete sentence. Max 150 chars.' },
        { position: 4, type: 'text-over-media', purpose: 'Point 3', guidance: 'Third insight or step. Complete sentence. Max 150 chars.' },
        { position: 5, type: 'media-only', purpose: 'Breathing room', guidance: 'Visual interlude — no text. Let the B-roll land.' },
        { position: 6, type: 'text-over-media', purpose: 'The key takeaway', guidance: 'What the viewer should do or believe now. Max 150 chars.' },
        { position: 'last', type: 'cta-card', purpose: 'Close with action', guidance: 'One direct CTA. Max 60 chars.' },
      ],
      captionStyle: 'Hook line + numbered list of 4-5 points + save/follow CTA.',
      hashtagCount: '10-15 hashtags — niche then broad',
    },
  },

  // ─── Reel: 2-Scene Contrast ───────────────────────────────────────────────
  {
    name: 'Reel — Before & After',
    format: 'reel',
    remotionId: 'standard-reel',
    sceneType: 'reel',
    scope: 'system',
    systemPrompt: `Build a contrast reel: hook-text to set up a contrast ("before" state), one text-over-media for the "before" (the problem, the wrong way, or what most people do), one text-over-media for the "after" (the solution, the right way, or what successful people do), and a cta-card. 4 scenes total. The contrast should feel sharp and relatable — the viewer should see themselves in the "before" and want the "after".`,
    contentSchema: {
      format: 'reel',
      totalScenes: '4',
      structure: [
        { position: 1, type: 'hook-text', purpose: 'Set up the contrast', guidance: 'Frame the tension — "Before vs After", "Wrong vs Right", "Most people vs Smart people". Max 70 chars.' },
        { position: 2, type: 'text-over-media', purpose: '"Before" — the problem', guidance: 'What the viewer is currently doing or experiencing. Make it relatable. Max 150 chars.' },
        { position: 3, type: 'text-over-media', purpose: '"After" — the solution', guidance: 'What changes when they apply the insight. Specific and aspirational. Max 150 chars.' },
        { position: 'last', type: 'cta-card', purpose: 'Bridge to action', guidance: 'Connect the "after" to an action: save, follow, DM. Max 60 chars.' },
      ],
      captionStyle: 'Before/After framing in caption. Lead with the relatable "before", pivot to the insight, end with CTA.',
      hashtagCount: '8-12 hashtags',
    },
  },

  // ─── Reel: 3-Scene Story Arc ─────────────────────────────────────────────
  {
    name: 'Reel — Story Arc',
    format: 'reel',
    remotionId: 'standard-reel',
    sceneType: 'reel',
    scope: 'system',
    systemPrompt: `Write a 5-scene micro-story reel: hook-text with a tension or question, text-over-media scene 1 for the setup/context, text-over-media scene 2 for the conflict or turning point, text-over-media scene 3 for the resolution or insight, and a cta-card. Pacing: short / mid / short text structure — hook is punchy, middle scene is the densest, final value scene is crisp. The viewer should feel a complete narrative arc.`,
    contentSchema: {
      format: 'reel',
      totalScenes: '5',
      structure: [
        { position: 1, type: 'hook-text', purpose: 'Open the story loop', guidance: 'Short punchy opener — creates curiosity or tension. Max 70 chars.' },
        { position: 2, type: 'text-over-media', purpose: 'Setup/context', guidance: 'Short scene: establish where we are, who this is about. Max 100 chars.' },
        { position: 3, type: 'text-over-media', purpose: 'Conflict/turning point', guidance: 'Longer scene: the problem, the mistake, the challenge. Most detail here. Max 150 chars.' },
        { position: 4, type: 'text-over-media', purpose: 'Resolution/insight', guidance: 'Short scene: the lesson or outcome — crisp and memorable. Max 100 chars.' },
        { position: 'last', type: 'cta-card', purpose: 'Close the loop', guidance: 'CTA that connects to the story outcome. Max 60 chars.' },
      ],
      captionStyle: 'Tell the mini-story in caption form. 3 short paragraphs: setup → conflict → resolution. CTA at end.',
      hashtagCount: '8-12 hashtags',
    },
  },

  // ─── Head Talk: Pain of Niche ─────────────────────────────────────────────
  {
    name: 'Head Talk — Pain of Niche',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    systemPrompt: `Write a 15-30 second head talk that opens by naming the specific pain your niche feels every day — the frustration they can't quite articulate. Then validate why it's not their fault. Close with a reframe or first step. The viewer should feel seen before they feel helped. Tone: warm, direct, zero condescension. Hook must name the pain specifically — not "if you're struggling" but the exact feeling or situation.`,
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '15-30',
      structure: 'pain-naming → validation → reframe',
      sections: [
        { key: 'hook', label: 'Hook', guidance: 'Name the specific pain or frustration your niche feels. Be precise — not "struggling" but the actual feeling or situation. Max 2 sentences.', maxWords: 30 },
        { key: 'body', label: 'Body', guidance: 'Validate why this is hard (systemic, not personal). Then offer one reframe or first step. Keep it tight — 15-30s means 60-90 words max on camera.', maxWords: 90 },
        { key: 'cta', label: 'CTA', guidance: 'Soft close — invite them to follow for more, or ask a question in comments. 1 sentence.', maxWords: 20 },
      ],
      captionStyle: 'Mirror the pain in the first line. 2-3 sentences of validation. One actionable line. End with a comment question.',
      hashtagCount: '8-12 niche-specific hashtags',
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Pain-naming hook — max 2 sentences' },
        body: { type: 'string', description: 'Validation + reframe — max 90 words' },
        cta: { type: 'string', description: 'Soft close — 1 sentence' },
        caption: { type: 'string', description: 'Social media caption' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
  },

  // ─── Head Talk: Fictional Experience ─────────────────────────────────────
  {
    name: 'Head Talk — Relatable Scenario',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    systemPrompt: `Write a 30-45 second head talk built around a fictional but deeply believable experience that resonates with the niche. It feels real: a specific moment, a specific feeling, a specific decision. The viewer thinks "that's me" before they realize it's a composite scenario. Structure: Scene-set → Recognition → Lesson → CTA. Voice: conversational, first-person, no "quote-unquote story time" framing — just start in the scene.`,
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '30-45',
      structure: 'scene-set → recognition → lesson → cta',
      sections: [
        { key: 'hook', label: 'Scene-Set Hook', guidance: 'Drop into a specific moment — a thought, a place, a decision. "You\'re sitting at your desk and…" Make it so specific it feels real. Max 3 sentences.', maxWords: 45 },
        { key: 'body', label: 'Recognition + Lesson', guidance: 'Name what the person in the scene was feeling or thinking (recognition), then pivot to the lesson or insight that changes everything. 120-150 words.', maxWords: 150 },
        { key: 'cta', label: 'CTA', guidance: 'Invite reflection or action — "Has this happened to you? Tell me below." or "Follow — I share these every week." Max 2 sentences.', maxWords: 30 },
      ],
      captionStyle: 'Open with the scene moment as a hook line. Expand with the recognition. Close with the lesson and a question for comments.',
      hashtagCount: '8-12 hashtags',
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Scene-set hook — max 3 sentences' },
        body: { type: 'string', description: 'Recognition + lesson — 120-150 words' },
        cta: { type: 'string', description: 'CTA — max 2 sentences' },
        caption: { type: 'string', description: 'Social media caption' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
  },

  // ─── Head Talk: Fictional Case Story ─────────────────────────────────────
  {
    name: 'Head Talk — Case Story',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    systemPrompt: `Write a 30-45 second head talk structured as a fictional case story — a composite character (not "a client", but a named or described person) who had a specific problem, took a specific action, and got a specific result. It must feel real enough to be true. Structure: Character intro → Problem → Action/Turning point → Result → Lesson → CTA. Numbers make it real. Specificity makes it credible. The "result" must feel believable, not fantastical.`,
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '30-45',
      structure: 'character → problem → turning point → result → lesson → cta',
      sections: [
        { key: 'hook', label: 'Character Hook', guidance: 'Introduce the person in one vivid sentence — their role, situation, or defining trait. Then immediately their problem. "María, a solo founder two weeks from running out of cash, was about to make a decision that would define the next three years." Max 3 sentences.', maxWords: 50 },
        { key: 'body', label: 'Story + Lesson', guidance: 'Walk through the action they took, the result (with specific numbers or details), and the lesson extracted. 130-160 words.', maxWords: 160 },
        { key: 'cta', label: 'CTA', guidance: 'Bridge from the story to the viewer — "If you\'re in that situation right now…" or "This is what I teach every week." Max 2 sentences.', maxWords: 30 },
      ],
      captionStyle: 'Lead with the result (reverse chronology hook). Tell the story in 3-4 short paragraphs. Close with the lesson and a comment question.',
      hashtagCount: '8-12 hashtags',
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Character + problem hook — max 3 sentences' },
        body: { type: 'string', description: 'Story + lesson — 130-160 words' },
        cta: { type: 'string', description: 'Bridge CTA — max 2 sentences' },
        caption: { type: 'string', description: 'Social media caption' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
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
