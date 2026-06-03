import type { PrismaClient } from '../../src/generated/prisma'

/**
 * System template definitions — available to all brands.
 *
 * Reel templates:
 *   Block-based (DynamicReel). scenes: SceneDef[] defines each scene's texts,
 *   background, overlay, and text styling. The AI fills 'prompt'-mode text
 *   blocks; 'manual'-mode blocks are used verbatim.
 *
 * Head Talk templates:
 *   No Remotion composition. contentSchema holds { scriptPrompt, captionPrompt }
 *   which are used by the HeadTalk draft pipeline. Brands can override prompts
 *   per-brand via BrandTemplateConfig.customPrompt.
 */

export interface SlotDef {
  key: string
  label: string
  intention: string // what this text must achieve — passed verbatim to AI
  minWords?: number // soft lower bound — AI must meet or exceed this
  maxWords: number // hard word limit — AI must not exceed
  style: 'short' | 'medium' | 'long' // drives font size in component
}

// Minimal scene/text type mirrors for seed use (avoids importing from src)
interface TextSeed {
  id: string
  mode: 'prompt' | 'manual'
  content: string
  font: string
  color: string
  maxTextSize: number
  textStyle: 'none' | 'stroke' | 'background_block'
  styleColor: string
  horizontalAlign: 'left' | 'center' | 'right'
  minWords?: number
  maxWords?: number
}

interface SceneSeed {
  id: string
  backgroundVideoAssetId: null
  backgroundVideoUrl: null
  backgroundVideoDurationSecs: null
  overlayColor: string
  overlayOpacity: number
  textVerticalAlign: 'top' | 'center' | 'bottom'
  texts: TextSeed[]
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
  scenes?: SceneSeed[]
}

// ── Default scene styling ─────────────────────────────────────────────────────

const SCENE_DEFAULTS = {
  backgroundVideoAssetId: null,
  backgroundVideoUrl: null,
  backgroundVideoDurationSecs: null,
  overlayColor: '#000000',
  overlayOpacity: 0.5,
  textVerticalAlign: 'center' as const,
}

const TEXT_DEFAULTS = {
  mode: 'prompt' as const,
  font: 'Anton',
  color: '#ffffff',
  maxTextSize: 100,
  textStyle: 'none' as const,
  styleColor: '#000000',
  horizontalAlign: 'center' as const,
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
    description:
      'Opens with a hyper-specific personal moment or feeling the creator genuinely experienced, shares it without moralising, then asks if the viewer has felt the same. No teaching, no proof — just two people talking. Drives comments and DMs. Best for 15–30 s community-building clips.',
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '15-30',
      scriptPrompt:
        'Write a continuous spoken script in three movements: (1) Drop into a specific, real-feeling moment — a thought, feeling, or situation. Not a lesson. Specific enough to be recognisable: "I was [doing X] and suddenly I felt…" Max 3 sentences. (2) Sit with the experience — think out loud. Not an answer. Slightly vulnerable, genuinely curious. ~60-90 spoken words. (3) A genuine open question directed at the viewer: "Does this happen to you?" / "Am I the only one?" Warm, low-pressure. Max 2 sentences. Write all three movements as one flowing script. Total: 100-155 spoken words.',
      captionPrompt:
        'Instagram caption for when the video is published. 2-3 sentences, engaging, no hashtags. Match the warm, curious tone of the script.',
    },
  },

  // ─── Head Talk: Niche Tea (15-30s) ────────────────────────────────────────
  {
    name: 'Head Talk — Niche Tea',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    description:
      "Points at something happening inside the niche — a pattern, a behaviour, a thing people say or do — with the tone of a trusted friend who noticed something and can't not mention it. Not a lecture. Not a takedown. Soft-polemic: the creator has a clear perspective but leaves room for the audience to chime in. Best for 15–30 s high-engagement clips that turn the niche into the subject.",
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '15-30',
      scriptPrompt:
        'Write a continuous spoken script in three movements: (1) Name something specific happening in or around the niche — a trend, belief, behaviour, or thing people post/say/do — without immediately judging it. Pull the viewer aside: "Okay so I need to talk about [thing]." Max 2 sentences. (2) Give the honest, slightly cheeky take. Not a rant or verdict — an observation you\'d share over coffee. Use "I think", "I\'ve noticed", "what gets me is". Mildly provocative. ~60-90 spoken words. (3) Pull the audience in: "What do you think?" / "Tell me I\'m not the only one who sees this." Genuinely open. Max 1 sentence. Write all three as one flowing script. Total: 90-130 spoken words.',
      captionPrompt:
        'Instagram caption for when the video is published. 2-3 sentences, conversational and slightly provocative. No hashtags.',
    },
  },

  // ─── Head Talk: Contrarian Take (15-30s) ─────────────────────────────────
  {
    name: 'Head Talk — Contrarian Take',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    description:
      'Opens by naming a widely-held belief, flips it with a single precise counter-claim, then proves it fast. Drives comments, saves, and shares. Best for 15–30 s clips that position the creator as a sharp contrarian thinker.',
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '15-30',
      scriptPrompt:
        'Write a continuous spoken script in three movements: (1) State a widely-held belief in the niche — then immediately flip it. "Everyone says [X]. That\'s wrong." or "[Conventional wisdom]. I disagree." The flip must be specific, not vague. Do not soften it. Max 2 sentences. (2) Give the single strongest reason the contrarian claim is correct. One mechanism, one data point, one lived observation — not a list. Concrete and specific. ~60-90 spoken words. (3) Invite the debate openly: "Tell me I\'m wrong in the comments." or a direct follow prompt framing them as open-minded for agreeing. Max 1 sentence. Write all three as one flowing script. Total: 90-130 spoken words.',
      captionPrompt:
        'Instagram caption for when the video is published. 2-3 sentences that tease the contrarian claim without giving away the argument. No hashtags.',
    },
  },

  // ─── Head Talk: Before & After (30-45s) ──────────────────────────────────
  {
    name: 'Head Talk — Before & After',
    format: 'head_talk',
    remotionId: '',
    sceneType: 'head_talk',
    scope: 'system',
    description:
      'Opens at the "before" state with a specific detail, pivots to the turning point, then shows the "after" with equally concrete numbers or facts. Builds credibility through transformation evidence. Best for 30–45 s authority and trust-building clips.',
    contentSchema: {
      format: 'head_talk',
      targetDurationSeconds: '30-45',
      scriptPrompt:
        'Write a continuous spoken script in four movements: (1) Drop the viewer into a specific "before" moment — a number, feeling, or situation that is recognisably bad or stuck. Be concrete: "12 months ago I was [specific state]." Max 3 sentences. (2) Name the single decision or insight that changed things (turning point — 1 sentence). Then show the "after" with a specific result. (3) Extract the transferable lesson in 1-2 sentences — what made the difference. (4) Bridge to the viewer\'s situation: "If you\'re in the before right now…" Max 2 sentences. Write all four as one flowing script. Total: 155-225 spoken words.',
      captionPrompt:
        'Instagram caption for when the video is published. 2-3 sentences that tease the transformation with a concrete before/after detail. No hashtags.',
    },
  },

  // ─── Reel — Single Moment (~8s, 1 short text) ────────────────────────────
  {
    name: 'Reel — Single Moment',
    format: 'reel',
    remotionId: 'DynamicReel',
    sceneType: 'reel',
    scope: 'system',
    previewUrl:
      'https://media.9nau.com/flownau/accounts/cmogyjn5a0006gcv46nis4o0l/outputs/cmoo6vorl0007v4v4oy5qiq3e.mp4',
    description:
      'One punchy line — max 8 words — displayed over full-screen B-roll. Pure pattern interrupt. ~4 s total. Use for quotes, provocations, or single-idea statements that land without context.',
    contentSchema: {
      note: 'Single short text reel. 1 scene, ~4 seconds. Big text, centered, over B-roll.',
    },
    scenes: [
      {
        id: 'scene-single-moment-1',
        ...SCENE_DEFAULTS,
        overlayOpacity: 0.45,
        texts: [
          {
            id: 'text-single-moment-1',
            ...TEXT_DEFAULTS,
            mode: 'prompt',
            content:
              'A single punchy statement or question that hits like a punch — the viewer stops scrolling because this one line cuts through. Could be provocative, surprising, or deeply relatable. No setup, no explanation. Just the line.',
            maxWords: 8,
          },
        ],
      },
    ],
  },

  // ─── Reel — Single Statement (~18s, 1 long text) ─────────────────────────
  {
    name: 'Reel — Single Statement',
    format: 'reel',
    remotionId: 'DynamicReel',
    sceneType: 'reel',
    scope: 'system',
    previewUrl:
      'https://media.9nau.com/flownau/accounts/cmogyjn5a0006gcv46nis4o0l/outputs/cmoo6vork0003v4v4v0f7jhx5.mp4',
    description:
      'One complete paragraph — up to 40 words — displayed over B-roll as the viewer reads along. Meditative pace. ~6.5 s. Best for a nuanced take, a belief, or a self-contained insight that benefits from dwell time.',
    contentSchema: {
      note: 'Single long text reel. 1 scene, ~18 seconds. Smaller text, over B-roll.',
    },
    scenes: [
      {
        id: 'scene-single-statement-1',
        ...SCENE_DEFAULTS,
        overlayOpacity: 0.4,
        texts: [
          {
            id: 'text-single-statement-1',
            ...TEXT_DEFAULTS,
            mode: 'prompt',
            content:
              'A complete, self-contained idea — a mini-paragraph that says something real. It should make the viewer feel smart, seen, or slightly challenged. Flows naturally when read aloud. No bullet points, no line breaks. Just clean prose with a clear point.',
            minWords: 25,
            maxWords: 40,
          },
        ],
      },
    ],
  },

  // ─── Reel — Hook & Reveal (~15s, 2 texts) ────────────────────────────────
  {
    name: 'Reel — Hook & Reveal',
    format: 'reel',
    remotionId: 'DynamicReel',
    sceneType: 'reel',
    scope: 'system',
    previewUrl:
      'https://media.9nau.com/flownau/accounts/cmogyjn5a0006gcv46nis4o0l/outputs/cmoo6vork0002v4v4is5hqueg.mp4',
    description:
      'Two scenes: a short hook (≤8 words) that creates tension, followed by the payoff reveal (≤25 words). The gap between them keeps the viewer watching. ~8 s total. Best for curiosity-driven content and contrarian takes.',
    contentSchema: {
      note: 'Two-scene reel. Scene 1: short hook (~4s). Scene 2: medium reveal (~10s). Total ~14s.',
    },
    scenes: [
      {
        id: 'scene-hook-reveal-1',
        ...SCENE_DEFAULTS,
        overlayOpacity: 0.45,
        texts: [
          {
            id: 'text-hook-reveal-1',
            ...TEXT_DEFAULTS,
            mode: 'prompt',
            content:
              'The opening fragment — creates tension or curiosity. Must be incomplete on its own; the viewer must need scene 2 to understand it. A question without the answer, a bold claim without the proof, or the first half of a reframe.',
            maxWords: 8,
          },
        ],
      },
      {
        id: 'scene-hook-reveal-2',
        ...SCENE_DEFAULTS,
        overlayOpacity: 0.4,
        texts: [
          {
            id: 'text-hook-reveal-2',
            ...TEXT_DEFAULTS,
            mode: 'prompt',
            content:
              'The direct continuation of scene 1 — delivers the payoff, answer, or second half of the reframe. Should feel like the natural end of a sentence that scene 1 started. Together they form one complete thought.',
            minWords: 15,
            maxWords: 25,
          },
        ],
      },
    ],
  },

  // ─── Reel — Arc (~18s, 3 texts: short-mid-short) ─────────────────────────
  {
    name: 'Reel — Arc',
    format: 'reel',
    remotionId: 'DynamicReel',
    sceneType: 'reel',
    scope: 'system',
    previewUrl:
      'https://media.9nau.com/flownau/accounts/cmogyjn5a0006gcv46nis4o0l/outputs/cmoo6vorl0008v4v4fyywc8cv.mp4',
    description:
      'Three scenes forming a mini story arc: punchy opener (≤8 w) → development (≤20 w) → landing line (≤8 w). ~11 s total. The most complete reel structure — best for ideas that need setup and resolution.',
    contentSchema: {
      note: 'Three-scene arc reel. Scene 1: short opener (~4s). Scene 2: medium body (~8s). Scene 3: short landing (~4s).',
    },
    scenes: [
      {
        id: 'scene-arc-1',
        ...SCENE_DEFAULTS,
        overlayOpacity: 0.45,
        texts: [
          {
            id: 'text-arc-1',
            ...TEXT_DEFAULTS,
            mode: 'prompt',
            content:
              'The inciting line — sets up a tension, question, or bold claim that demands resolution. Must be incomplete on its own. The viewer should think "wait, what?" and need the next scene.',
            maxWords: 8,
          },
        ],
      },
      {
        id: 'scene-arc-2',
        ...SCENE_DEFAULTS,
        overlayOpacity: 0.4,
        texts: [
          {
            id: 'text-arc-2',
            ...TEXT_DEFAULTS,
            mode: 'prompt',
            content:
              'The body of the arc — directly continues from scene 1 and delivers the substance: the insight, the context, the why. This is where the idea earns its weight. Must be long enough to feel satisfying, not a fragment.',
            minWords: 12,
            maxWords: 20,
          },
        ],
      },
      {
        id: 'scene-arc-3',
        ...SCENE_DEFAULTS,
        overlayOpacity: 0.45,
        texts: [
          {
            id: 'text-arc-3',
            ...TEXT_DEFAULTS,
            mode: 'prompt',
            content:
              'The closing line — the punchline, reframe, or lesson that scene 1 + scene 2 were building toward. Short and final, like the last sentence of a paragraph. The viewer should feel the arc is complete.',
            maxWords: 8,
          },
        ],
      },
    ],
  },
]

// ─── SEED FUNCTIONS ───────────────────────────────────────────────────────────

const REMOVED_TEMPLATE_NAMES = [
  'Reel — Storytelling Arc',
  'Reel — Hook & Value',
  'Reel — Long Form Value',
  'Reel — Before & After',
  'Reel — Story Arc',
  'Head Talk — Hook First',
  'Head Talk — Pain of Niche',
  'Head Talk — Relatable Story',
  'Head Talk — Case Story',
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
        scenes: (t.scenes as any) ?? undefined,
        useBrandAssets: false,
      },
      update: {
        description: t.description ?? null,
        previewUrl: t.previewUrl ?? null,
        contentSchema: t.contentSchema,
        slotSchema: (t.slotSchema as any) ?? undefined,
        schemaJson: t.schemaJson ?? undefined,
        scenes: (t.scenes as any) ?? undefined,
        remotionId: t.remotionId,
        format: t.format,
      },
    })
    console.log(
      `  ✓ Seeded system template: "${t.name}" (${t.format}) [remotionId=${t.remotionId || 'none'}]`,
    )
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
