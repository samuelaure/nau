import type { PrismaClient } from '../../src/generated/prisma'

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
  minWords?: number  // soft lower bound — AI must meet or exceed this
  maxWords: number   // hard word limit — AI must not exceed
  style: 'short' | 'medium' | 'long'  // drives font size in component
}

interface TemplateDefinition {
  name: string
  format: string
  remotionId: string
  sceneType: string
  scope: string
  description?: string
  previewUrl?: string
  slotSchema?: SlotDef[]
  contentSchema: object
  schemaJson?: object
}

// ─── SYSTEM TEMPLATES ─────────────────────────────────────────────────────────

export const SYSTEM_TEMPLATES: TemplateDefinition[] = [

  // ─── Head Talk: Does This Happen to You (15-30s) ─────────────────────────
  {
    name: 'Head Talk — Does This Happen to You',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    description: 'Opens with a hyper-specific personal moment or feeling the creator genuinely experienced, shares it without moralising, then asks if the viewer has felt the same. No teaching, no proof — just two people talking. Drives comments and DMs. Best for 15–30 s community-building clips.',
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '15-30',
      structure: 'personal-moment → honest-reflection → open-question',
      sections: [
        { key: 'hook', label: 'Hook — The Personal Moment', intention: 'Drop into a specific, real-feeling moment the creator experienced — a thought, a feeling, a situation. Not a lesson. Not a claim. Just "this happened to me / I noticed this about myself." Specific enough to be recognisable: "I was [doing X] and suddenly I felt..." or "The other day I caught myself doing [Y] and I couldn\'t stop thinking about it." Max 3 sentences. No moralising. Just the moment.', maxWords: 40 },
        { key: 'body', label: 'Honest Reflection', intention: 'The creator sits with the experience — what they thought, felt, noticed, or couldn\'t figure out. Not an answer. Not advice. More like thinking out loud. Slightly vulnerable, genuinely curious. The viewer should feel like they\'re listening in on an honest internal monologue, not a polished lesson. 15-30s = 60-90 spoken words.', maxWords: 90 },
        { key: 'cta', label: 'Open Question', intention: 'A genuine, open question directed at the viewer. Not rhetorical. Not leading. The creator actually wants to know: "Does this happen to you?" / "Am I the only one?" / "I\'d love to know if you\'ve been through this — tell me in the comments." Warm, low-pressure. Max 2 sentences.', maxWords: 25 },
      ],
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Personal moment — max 40 words' },
        body: { type: 'string', description: 'Honest reflection — max 90 words' },
        cta: { type: 'string', description: 'Open question — max 25 words' },
        caption: { type: 'string', description: 'Instagram caption' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
  },

  // ─── Head Talk: Niche Tea (15-30s) ────────────────────────────────────────
  {
    name: 'Head Talk — Niche Tea',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    description: 'Points at something happening inside the niche — a pattern, a behaviour, a thing people say or do — with the tone of a trusted friend who noticed something and can\'t not mention it. Not a lecture. Not a takedown. Soft-polemic: the creator has a clear perspective but leaves room for the audience to chime in. Best for 15–30 s high-engagement clips that turn the niche into the subject.',
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '15-30',
      structure: 'the-thing → honest-take → invite',
      sections: [
        { key: 'hook', label: 'Hook — Name The Thing', intention: 'Point at something specific happening in or around the niche — a trend, a belief, a behaviour, a thing people post, say, or do — without immediately judging it. Name it like you\'re pulling your friend aside: "Okay so I need to talk about [thing]." or "Have you noticed that everyone in [niche] is now [doing X]?" Specific and recognisable to insiders. Max 2 sentences.', maxWords: 35 },
        { key: 'body', label: 'The Honest Take', intention: 'The creator\'s real perspective on the thing — not a rant, not a verdict, but an honest, slightly cheeky observation. Can be mildly provocative. Should feel like what you\'d say to a friend over coffee, not what you\'d say in a debate. Use "I think", "I\'ve noticed", "what gets me is" — keeps it personal, not preachy. A small piece of nuance or inside knowledge that makes followers feel like they\'re in the know. 15-30s = 60-90 spoken words.', maxWords: 90 },
        { key: 'cta', label: 'Invite', intention: 'Pull the audience into the conversation: "What do you think?" / "Tell me I\'m not the only one who sees this." / "Am I off base here?" Genuinely open — the creator doesn\'t need to be right, they\'re curious. Max 1 sentence.', maxWords: 20 },
      ],
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Name the thing — max 35 words' },
        body: { type: 'string', description: 'Honest take — max 90 words' },
        cta: { type: 'string', description: 'Invite — max 20 words' },
        caption: { type: 'string', description: 'Instagram caption' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
  },

  // ─── Head Talk: Contrarian Take (15-30s) ─────────────────────────────────
  {
    name: 'Head Talk — Contrarian Take',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    description: 'Opens by naming a widely-held belief, flips it with a single precise counter-claim, then proves it fast. Drives comments, saves, and shares. Best for 15–30 s clips that position the creator as a sharp contrarian thinker.',
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '15-30',
      structure: 'common-belief → flip → proof → cta',
      sections: [
        { key: 'hook', label: 'Hook — Name the Belief & Flip It', intention: 'State a widely-held belief in the niche — then immediately flip it. "Everyone says [X]. That\'s wrong." or "[Conventional wisdom]. I disagree." The flip must be specific, not vague. Do not soften it. The viewer should feel a jolt of surprise or mild offense. Max 2 sentences.', maxWords: 30 },
        { key: 'body', label: 'The Proof', intention: 'Give the single strongest reason the contrarian claim is correct. One mechanism, one data point, one lived observation — not a list. Concrete and specific. The viewer should think "I never thought of it that way." 15-30s = 60-90 spoken words.', maxWords: 90 },
        { key: 'cta', label: 'CTA', intention: 'Invite the debate openly. "Tell me I\'m wrong in the comments." or a direct follow prompt that frames them as open-minded for agreeing. Max 1 sentence.', maxWords: 20 },
      ],
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Belief + flip — max 30 words' },
        body: { type: 'string', description: 'Single proof — max 90 words' },
        cta: { type: 'string', description: 'Debate invite — max 20 words' },
        caption: { type: 'string', description: 'Instagram caption' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
  },

  // ─── Head Talk: Before & After (30-45s) ──────────────────────────────────
  {
    name: 'Head Talk — Before & After',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    description: 'Opens at the "before" state with a specific detail, pivots to the turning point, then shows the "after" with equally concrete numbers or facts. Builds credibility through transformation evidence. Best for 30–45 s authority and trust-building clips.',
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '30-45',
      structure: 'before → turning-point → after → lesson → cta',
      sections: [
        { key: 'hook', label: 'Hook — The Before', intention: 'Drop the viewer into a specific "before" moment — a number, a feeling, a situation that is recognisably bad or stuck. Be concrete: "12 months ago I was [specific state]." Avoid vague openers. The specificity is what makes it credible and relatable. Max 3 sentences.', maxWords: 45 },
        { key: 'body', label: 'Turning Point + After + Lesson', intention: 'Name the single decision or insight that changed things (turning point — keep it to 1 sentence). Then show the "after" with a specific result (a number, a change, a capability). Extract the transferable lesson in 1-2 sentences — what made the difference that the viewer can apply. 30-45s = 110-150 spoken words.', maxWords: 150 },
        { key: 'cta', label: 'CTA', intention: 'Bridge to the viewer\'s situation: "If you\'re in the before right now..." or a follow prompt that positions future content as the roadmap. Max 2 sentences.', maxWords: 30 },
      ],
    },
    schemaJson: {
      type: 'object',
      required: ['hook', 'body', 'cta', 'caption', 'hashtags'],
      properties: {
        hook: { type: 'string', description: 'Before state — max 45 words' },
        body: { type: 'string', description: 'Turning point + after + lesson — max 150 words' },
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
    previewUrl: 'https://media.9nau.com/flownau/accounts/cmogyjn5a0006gcv46nis4o0l/outputs/cmoo6vorl0007v4v4oy5qiq3e.mp4',
    description: 'One punchy line — max 8 words — displayed over full-screen B-roll. Pure pattern interrupt. ~4 s total. Use for quotes, provocations, or single-idea statements that land without context.',
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
    previewUrl: 'https://media.9nau.com/flownau/accounts/cmogyjn5a0006gcv46nis4o0l/outputs/cmoo6vork0003v4v4v0f7jhx5.mp4',
    description: 'One complete paragraph — up to 40 words — displayed over B-roll as the viewer reads along. Meditative pace. ~6.5 s. Best for a nuanced take, a belief, or a self-contained insight that benefits from dwell time.',
    slotSchema: [
      {
        key: 'text1',
        label: 'The Statement',
        intention: 'A complete, self-contained idea — a mini-paragraph that says something real. It should make the viewer feel smart, seen, or slightly challenged. Flows naturally when read aloud. No bullet points, no line breaks. Just clean prose with a clear point.',
        minWords: 25,
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
    previewUrl: 'https://media.9nau.com/flownau/accounts/cmogyjn5a0006gcv46nis4o0l/outputs/cmoo6vork0002v4v4is5hqueg.mp4',
    description: 'Two scenes: a short hook (≤8 words) that creates tension, followed by the payoff reveal (≤25 words). The gap between them keeps the viewer watching. ~8 s total. Best for curiosity-driven content and contrarian takes.',
    slotSchema: [
      {
        key: 'text1',
        label: 'The Hook',
        intention: 'The opening fragment — creates tension or curiosity. Must be incomplete on its own; the viewer must need text2 to understand it. A question without the answer, a bold claim without the proof, or the first half of a reframe.',
        maxWords: 8,
        style: 'short',
      },
      {
        key: 'text2',
        label: 'The Reveal',
        intention: 'The direct continuation of text1 — delivers the payoff, answer, or second half of the reframe. Should feel like the natural end of a sentence that text1 started. Together they form one complete thought.',
        minWords: 15,
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
    previewUrl: 'https://media.9nau.com/flownau/accounts/cmogyjn5a0006gcv46nis4o0l/outputs/cmoo6vorl0008v4v4fyywc8cv.mp4',
    description: 'Three scenes forming a mini story arc: punchy opener (≤8 w) → development (≤20 w) → landing line (≤8 w). ~11 s total. The most complete reel structure — best for ideas that need setup and resolution.',
    slotSchema: [
      {
        key: 'text1',
        label: 'Opening',
        intention: 'The inciting line — sets up a tension, question, or bold claim that demands resolution. Must be incomplete on its own. The viewer should think "wait, what?" and need the next screen.',
        maxWords: 8,
        style: 'short',
      },
      {
        key: 'text2',
        label: 'Development',
        intention: 'The body of the arc — directly continues from text1 and delivers the substance: the insight, the context, the why. This is where the idea earns its weight. Must be long enough to feel satisfying, not a fragment.',
        minWords: 12,
        maxWords: 20,
        style: 'medium',
      },
      {
        key: 'text3',
        label: 'Landing',
        intention: 'The closing line — the punchline, reframe, or lesson that text1 + text2 were building toward. Short and final, like the last sentence of a paragraph. The viewer should feel the arc is complete.',
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
        description: t.description ?? null,
        previewUrl: t.previewUrl ?? null,
        contentSchema: t.contentSchema,
        slotSchema: (t.slotSchema as any) ?? undefined,
        schemaJson: t.schemaJson ?? undefined,
        useBrandAssets: false,
      },
      update: {
        description: t.description ?? null,
        previewUrl: t.previewUrl ?? null,
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
