import type { PrismaClient } from '@prisma/client'

/**
 * System template definitions — available to all brands.
 *
 * Reel templates use slotSchema to define what text the AI must fill.
 * Each slot has: key, label, intention (why this text), maxWords (hard limit),
 * and style (short/medium/long — drives font size in Remotion component).
 *
 * The AI slot-composer reads slotSchema and produces { slots: Record<string,string>, caption, hashtags, brollMood }.
 * The Remotion component reads those slots and renders them with brand identity applied.
 */

export interface SlotDef {
  key: string
  label: string
  intention: string  // what this text must achieve — passed verbatim to AI
  maxWords: number   // hard word limit — AI must not exceed
  style: 'short' | 'medium' | 'long'  // drives font size in component
}

interface TemplateDefinition {
  name: string
  format: string
  remotionId: string  // maps to <Composition id="..."> in remotion/index.tsx
  sceneType: string
  scope: string
  systemPrompt: string
  slotSchema?: SlotDef[]   // reel templates: defines text slots for AI + Remotion
  contentSchema: object    // human-readable guidance (also used for head_talk output schema)
  schemaJson?: object      // JSON Schema for LLM structured output
}

// ─── SYSTEM TEMPLATES ─────────────────────────────────────────────────────────

const HEAD_TALK_SYSTEM_PROMPT = `You are a content creator who understands one fundamental truth about human attention: people do not stop scrolling for information — they stop for feeling.

Your job is to manufacture that feeling, then justify it.

Human decisions run on two systems. System 1 is fast, emotional, reflexive. System 2 is slow, rational, deliberate — it justifies what System 1 already decided.
Viral content wins System 1 in the first two seconds, then gives System 2 enough to feel good about sharing it.

Hook → activates System 1. Body → satisfies System 2. CTA → closes the loop.

VOICE: Speak like the smartest person in the room who doesn't need anyone to know it. Confident without arrogance. Direct without coldness.
You are talking to one specific person who is already thinking about this topic and will leave the moment they feel condescended to or sold at.

CRAFT RULES:
- Short sentences. Active verbs. Concrete nouns.
- "17%" beats "many". Specificity is the enemy of vagueness.
- Speak to one person: "you" not "people".
- Never open with "Today I want to talk about…" or the brand name.
- CTA: one action, closes the loop the hook opened. Not "follow for more content".
- No caveats or disclaimers in the hook.
- NEVER mention usernames or @handles.`

export const SYSTEM_TEMPLATES: TemplateDefinition[] = [

  // ─── Head Talk: Hook-First (15-30s) ──────────────────────────────────────
  {
    name: 'Head Talk — Hook First',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    systemPrompt: HEAD_TALK_SYSTEM_PROMPT,
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '15-30',
      structure: 'hook → body → cta',
      sections: [
        { key: 'hook', label: 'Hook', intention: 'Stop the scroll in 2 seconds using NOVELTY, TENSION, IDENTITY SIGNAL, or STATUS THREAT. Never start with "Today I want to talk about". Single punchy sentence or question.', maxWords: 25 },
        { key: 'body', label: 'Body', intention: 'Deliver the core insight or value. Concrete, specific, no filler. Short paragraphs — one idea each. 15-30s = 60-90 spoken words.', maxWords: 90 },
        { key: 'cta', label: 'CTA', intention: 'One action that closes the loop the hook opened. Feels like a natural ending. Follow / save / comment [specific prompt].', maxWords: 20 },
      ],
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Opening hook — max 25 words' },
        body: { type: 'string', description: 'Main content body — max 90 words' },
        cta: { type: 'string', description: 'Call to action — max 20 words' },
        caption: { type: 'string', description: 'Instagram caption for publishing' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags without # prefix' },
      },
    },
  },

  // ─── Head Talk: Pain of Niche (15-30s) ───────────────────────────────────
  {
    name: 'Head Talk — Pain of Niche',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    systemPrompt: HEAD_TALK_SYSTEM_PROMPT,
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '15-30',
      structure: 'pain-naming → validation → reframe',
      sections: [
        { key: 'hook', label: 'Hook — Name the Pain', intention: 'Name the specific pain or frustration the niche feels every day. Be precise — not "struggling" but the exact feeling or situation. "That moment when you..." or "You know that feeling of..." Max 2 sentences.', maxWords: 30 },
        { key: 'body', label: 'Validation + Reframe', intention: 'Validate why this pain is not their fault (systemic, not personal). Then offer one reframe or first step that changes how they see it. 15-30s = 60-90 spoken words.', maxWords: 90 },
        { key: 'cta', label: 'CTA', intention: 'Soft, warm close. Invite them to follow for more, or ask a reflective question for comments. 1 sentence.', maxWords: 20 },
      ],
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Pain-naming hook — max 30 words' },
        body: { type: 'string', description: 'Validation + reframe — max 90 words' },
        cta: { type: 'string', description: 'Soft close — max 20 words' },
        caption: { type: 'string', description: 'Instagram caption' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
  },

  // ─── Head Talk: Relatable Story (30-45s) ─────────────────────────────────
  {
    name: 'Head Talk — Relatable Story',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    systemPrompt: HEAD_TALK_SYSTEM_PROMPT,
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '30-45',
      structure: 'scene-set → recognition → lesson → cta',
      sections: [
        { key: 'hook', label: 'Scene-Set Hook', intention: 'Drop into a specific fictional-but-believable moment. A thought, a place, a decision. "You\'re sitting at your desk and..." Make it so specific it feels real — the viewer thinks "that\'s me". No framing like "story time". Just start in the scene. Max 3 sentences.', maxWords: 45 },
        { key: 'body', label: 'Recognition + Lesson', intention: 'Name what the person in the scene was feeling or thinking (recognition — the viewer should feel seen). Then pivot to the lesson or insight that changes everything. 30-45s = 110-150 spoken words.', maxWords: 150 },
        { key: 'cta', label: 'CTA', intention: 'Invite reflection or action. "Has this happened to you? Tell me below." or "Follow — I share these every week." Max 2 sentences.', maxWords: 30 },
      ],
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Scene-set hook — max 45 words' },
        body: { type: 'string', description: 'Recognition + lesson — max 150 words' },
        cta: { type: 'string', description: 'CTA — max 30 words' },
        caption: { type: 'string', description: 'Instagram caption' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
  },

  // ─── Head Talk: Case Story (30-45s) ──────────────────────────────────────
  {
    name: 'Head Talk — Case Story',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    systemPrompt: HEAD_TALK_SYSTEM_PROMPT,
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '30-45',
      structure: 'character → problem → turning point → result → lesson → cta',
      sections: [
        { key: 'hook', label: 'Character Hook', intention: 'Introduce a composite fictional person in one vivid sentence — their role, situation, or defining trait — then immediately their problem. "María, a solo founder two weeks from running out of cash, was about to make a decision that would define the next three years." Numbers and specifics make it real. Max 3 sentences.', maxWords: 50 },
        { key: 'body', label: 'Story + Lesson', intention: 'Walk through: the action they took, the result (with specific numbers or details), and the lesson extracted. Keep it believable, not fantastical. 30-45s = 120-160 spoken words.', maxWords: 160 },
        { key: 'cta', label: 'CTA', intention: 'Bridge from the story to the viewer. "If you\'re in that situation right now..." or "This is what I teach every week." Max 2 sentences.', maxWords: 30 },
      ],
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Character + problem hook — max 50 words' },
        body: { type: 'string', description: 'Story + lesson — max 160 words' },
        cta: { type: 'string', description: 'Bridge CTA — max 30 words' },
        caption: { type: 'string', description: 'Instagram caption' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
  },

  // ─── Reel T1: Single Moment (~8s, 1 short text) ───────────────────────────
  {
    name: 'Reel — Single Moment',
    format: 'reel',
    remotionId: 'ReelT1',
    sceneType: 'reel',
    scope: 'system',
    systemPrompt: 'You are filling content slots for a short-form video reel. Follow each slot\'s intention and word limit exactly. Never mention usernames or @handles.',
    slotSchema: [
      {
        key: 'text1',
        label: 'The Moment',
        intention: 'A single punchy statement or question that hits like a punch — the viewer stops scrolling because this one line cuts through. Could be provocative, surprising, or deeply relatable. No setup, no explanation. Just the line.',
        maxWords: 8,
        style: 'short',
      },
    ],
    contentSchema: { note: 'Single short text reel. 1 scene, ~8 seconds. Big text, centered, over B-roll.' },
    schemaJson: {
      type: 'object',
      required: ['slots', 'caption', 'hashtags', 'brollMood'],
      properties: {
        slots: {
          type: 'object',
          required: ['text1'],
          properties: { text1: { type: 'string', description: 'The single punchy line — max 8 words' } },
        },
        caption: { type: 'string', description: 'Instagram caption — expand on the single line with 2-3 sentences + CTA' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags without # prefix' },
        brollMood: { type: 'string', description: 'One or two mood keywords for B-roll asset selection (e.g. "family, nature", "urban, movement")' },
      },
    },
  },

  // ─── Reel T2: Single Statement (~18s, 1 long text) ───────────────────────
  {
    name: 'Reel — Single Statement',
    format: 'reel',
    remotionId: 'ReelT2',
    sceneType: 'reel',
    scope: 'system',
    systemPrompt: 'You are filling content slots for a short-form video reel. Follow each slot\'s intention and word limit exactly. Never mention usernames or @handles.',
    slotSchema: [
      {
        key: 'text1',
        label: 'The Statement',
        intention: 'A complete, self-contained idea — a mini-paragraph that says something real. It should make the viewer feel smart, seen, or slightly challenged. Flows naturally when read aloud. No bullet points, no line breaks. Just clean prose with a clear point.',
        maxWords: 40,
        style: 'long',
      },
    ],
    contentSchema: { note: 'Single long text reel. 1 scene, ~18 seconds. Smaller text, over B-roll.' },
    schemaJson: {
      type: 'object',
      required: ['slots', 'caption', 'hashtags', 'brollMood'],
      properties: {
        slots: {
          type: 'object',
          required: ['text1'],
          properties: { text1: { type: 'string', description: 'The complete statement — max 40 words, reads naturally aloud' } },
        },
        caption: { type: 'string', description: 'Instagram caption — expand with context and CTA' },
        hashtags: { type: 'array', items: { type: 'string' } },
        brollMood: { type: 'string', description: 'Mood keywords for B-roll (e.g. "serene, family", "focus, workspace")' },
      },
    },
  },

  // ─── Reel T3: Hook & Reveal (~15s, 2 texts) ──────────────────────────────
  {
    name: 'Reel — Hook & Reveal',
    format: 'reel',
    remotionId: 'ReelT3',
    sceneType: 'reel',
    scope: 'system',
    systemPrompt: 'You are filling content slots for a short-form video reel. Follow each slot\'s intention and word limit exactly. The two slots must feel like a connected thought — the second completes what the first started. Never mention usernames or @handles.',
    slotSchema: [
      {
        key: 'text1',
        label: 'The Hook',
        intention: 'A short, arresting opening that creates tension or curiosity. A question, a bold claim, or a surprising reframe. It must make the viewer want to know what comes next — not complete on its own.',
        maxWords: 8,
        style: 'short',
      },
      {
        key: 'text2',
        label: 'The Reveal',
        intention: 'The payoff that completes the hook. Delivers the insight, answer, or reframe the viewer was waiting for. Should feel satisfying — the "aha" moment. Reads naturally aloud in one breath.',
        maxWords: 25,
        style: 'medium',
      },
    ],
    contentSchema: { note: 'Two-scene reel. Scene 1: short hook (~5s). Scene 2: medium reveal (~10s). Total ~15s.' },
    schemaJson: {
      type: 'object',
      required: ['slots', 'caption', 'hashtags', 'brollMood'],
      properties: {
        slots: {
          type: 'object',
          required: ['text1', 'text2'],
          properties: {
            text1: { type: 'string', description: 'The hook — max 8 words' },
            text2: { type: 'string', description: 'The reveal — max 25 words' },
          },
        },
        caption: { type: 'string', description: 'Instagram caption — expand on the hook/reveal with context + CTA' },
        hashtags: { type: 'array', items: { type: 'string' } },
        brollMood: { type: 'string', description: 'Mood keywords for B-roll' },
      },
    },
  },

  // ─── Reel T4: Arc (~18s, 3 texts: short-mid-short) ───────────────────────
  {
    name: 'Reel — Arc',
    format: 'reel',
    remotionId: 'ReelT4',
    sceneType: 'reel',
    scope: 'system',
    systemPrompt: 'You are filling content slots for a short-form video reel. Follow each slot\'s intention and word limit exactly. The three slots must feel like a mini-story arc: opening → development → landing. Never mention usernames or @handles.',
    slotSchema: [
      {
        key: 'text1',
        label: 'Opening',
        intention: 'A short, punchy opener that sets up a tension or question. Hits immediately. Creates the "why should I keep watching" moment.',
        maxWords: 8,
        style: 'short',
      },
      {
        key: 'text2',
        label: 'Development',
        intention: 'The core of the idea — delivers the substance, context, or insight. This is where the most weight lives. Should expand on the opener and push the idea forward. Reads naturally aloud.',
        maxWords: 20,
        style: 'medium',
      },
      {
        key: 'text3',
        label: 'Landing',
        intention: 'A crisp, memorable closer. The line they remember and share. Could be a reframe, a lesson, or a call to action. Short and punchy like the opener — it lands with weight.',
        maxWords: 8,
        style: 'short',
      },
    ],
    contentSchema: { note: 'Three-scene arc reel. Scene 1: short (~5s). Scene 2: medium (~8s). Scene 3: short (~5s). Total ~18s.' },
    schemaJson: {
      type: 'object',
      required: ['slots', 'caption', 'hashtags', 'brollMood'],
      properties: {
        slots: {
          type: 'object',
          required: ['text1', 'text2', 'text3'],
          properties: {
            text1: { type: 'string', description: 'Opening — max 8 words' },
            text2: { type: 'string', description: 'Development — max 20 words' },
            text3: { type: 'string', description: 'Landing — max 8 words' },
          },
        },
        caption: { type: 'string', description: 'Instagram caption — tell the full arc with context + CTA' },
        hashtags: { type: 'array', items: { type: 'string' } },
        brollMood: { type: 'string', description: 'Mood keywords for B-roll' },
      },
    },
  },

]

// ─── SEED FUNCTIONS ───────────────────────────────────────────────────────────

const REMOVED_TEMPLATE_NAMES = [
  'Reel — Storytelling Arc',
  'Reel — Hook & Value',
  'Reel — Long Form Value',
  'Reel — Before & After',
  'Reel — Story Arc',
]

export async function seedSystemTemplates(prisma: PrismaClient): Promise<void> {
  for (const name of REMOVED_TEMPLATE_NAMES) {
    const stale = await prisma.template.findFirst({ where: { name, scope: 'system' } })
    if (stale) {
      await prisma.brandTemplateConfig.deleteMany({ where: { templateId: stale.id } })
      await prisma.template.delete({ where: { id: stale.id } })
      console.log(`  ✗ Removed retired system template: "${name}"`)
    }
  }

  for (const t of SYSTEM_TEMPLATES) {
    const existing = await prisma.template.findFirst({ where: { name: t.name, scope: 'system' } })
    await prisma.template.upsert({
      where: { id: existing?.id ?? 'noop' },
      create: {
        brandId: null,
        name: t.name,
        format: t.format,
        remotionId: t.remotionId,
        sceneType: t.sceneType,
        scope: 'system',
        systemPrompt: t.systemPrompt,
        contentSchema: t.contentSchema,
        slotSchema: (t.slotSchema as any) ?? undefined,
        schemaJson: t.schemaJson ?? undefined,
        useBrandAssets: false,
      },
      update: {
        systemPrompt: t.systemPrompt,
        contentSchema: t.contentSchema,
        slotSchema: (t.slotSchema as any) ?? undefined,
        schemaJson: t.schemaJson ?? undefined,
        remotionId: t.remotionId,
        format: t.format,
      },
    })
    console.log(`  ✓ Seeded system template: "${t.name}" (${t.format}) [remotionId=${t.remotionId || 'none'}]`)
  }
}

export async function seedTemplatesForBrand(prisma: PrismaClient, brandId: string): Promise<void> {
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
