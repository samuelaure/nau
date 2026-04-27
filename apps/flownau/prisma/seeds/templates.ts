import type { PrismaClient } from '@prisma/client'

/**
 * Platform-default template definitions.
 *
 * These are workspace-scoped so every brand in the same workspace can use them.
 * Each template shapes how the AI Creative Director structures and writes scenes.
 *
 * Fields used by scene-composer.ts:
 *   systemPrompt   → "TEMPLATE NARRATIVE GUIDANCE" block in the AI system prompt
 *   contentSchema  → "TEMPLATE CONTENT SCHEMA" block — exact slot guidance per scene
 *   sceneType      → matched by template-selector.ts (loose match on format)
 *   remotionId     → identifier the render service uses to pick the Remotion composition
 */

interface TemplateDefinition {
  name: string
  remotionId: string
  sceneType: string
  scope: string
  systemPrompt: string
  contentSchema: object
}

export const PLATFORM_TEMPLATES: TemplateDefinition[] = [
  // ─── Template 1: Reel — Hook & Value ──────────────────────────────
  {
    name: 'Reel — Hook & Value',
    remotionId: 'standard-reel',
    sceneType: 'reel',
    scope: 'workspace',
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
          guidance:
            'The main insight or key takeaway. Concrete and actionable — not vague. Max 150 chars.',
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
        'Short hook sentence + 3-4 value bullets + one-line CTA. Line breaks between sections. No hashtag stuffing in the caption body.',
      hashtagCount: '8-12 targeted hashtags — niche first, then broad',
    },
  },

  // ─── Template 2: Carousel — Step-by-Step Guide ────────────────────
  {
    name: 'Carousel — Step-by-Step Guide',
    remotionId: 'edu-carousel',
    sceneType: 'carousel',
    scope: 'workspace',
    systemPrompt: `Structure this as a step-by-step educational carousel. The cover slide sets a clear promise ("How to X in Y steps"). Each content-slide teaches exactly one point with a clear heading and 2-3 sentence body — no slide should have two ideas. Use a list-slide near the end as a quick-win recap. End with a strong save CTA. Voice should be a knowledgeable friend explaining, not a textbook. Aim for 6-8 slides total. Every slide should make the viewer want to swipe to the next.`,
    contentSchema: {
      format: 'carousel',
      totalSlides: '6-8',
      structure: [
        {
          position: 1,
          type: 'cover-slide',
          purpose: 'Hook the swipe',
          guidance:
            'Title: the promise or topic — "X steps to Y" or "How to Z". Subtitle: who this is for or a teaser that creates curiosity. Make them swipe. Max title 80 chars, subtitle 120 chars.',
        },
        {
          position: '2-5',
          type: 'content-slide',
          purpose: 'Teach one point per slide',
          guidance:
            'Heading: the step/point name (short and scannable, max 80 chars). Body: 2-3 sentences explaining it — concrete, specific, no filler. Max body 300 chars.',
        },
        {
          position: 'second-to-last',
          type: 'list-slide',
          purpose: 'Quick-win recap',
          guidance:
            'Title: "Quick Summary" or "The Short Version". Items: 3-5 bullets distilling the key actions from the slides. Each item max 80 chars.',
        },
        {
          position: 'last',
          type: 'cta-slide',
          purpose: 'Drive saves and follows',
          guidance:
            'CTA: "Save this for later" or "Follow for more [topic]". Include brand handle. Max CTA 60 chars.',
        },
      ],
      captionStyle:
        'Expand on the topic with one personal insight or example. Invite saves and shares. End with a question to drive comments.',
      hashtagCount: '10-15 hashtags — niche-specific + broad topic mix',
    },
  },

  // ─── Template 3: Reel — Storytelling Arc ──────────────────────────
  {
    name: 'Reel — Storytelling Arc',
    remotionId: 'story-reel',
    sceneType: 'reel',
    scope: 'workspace',
    systemPrompt: `Use a three-act narrative arc: hook (create tension or curiosity) → insight (a powerful quote or turning point) → resolution (the takeaway) → CTA (invite the viewer in). Prioritize emotional resonance over information density. The quote-card is the emotional centerpiece — make it powerful, memorable, and attributable if possible. B-roll should be atmospheric and mood-driven. Aim for 4-5 scenes. The viewer should feel something, not just learn something.`,
    contentSchema: {
      format: 'reel',
      totalScenes: '4-5',
      structure: [
        {
          position: 1,
          type: 'hook-text',
          purpose: 'Open a loop — create tension or curiosity',
          guidance:
            'A provocative question, a counter-intuitive statement, or a "most people think X but..." setup. Max 80 chars.',
        },
        {
          position: 2,
          type: 'text-over-media',
          purpose: 'Establish the stakes or context',
          guidance:
            'Describe the tension or problem in one sentence. B-roll mood: atmospheric, emotional, relevant. Max 150 chars.',
        },
        {
          position: 3,
          type: 'quote-card',
          purpose: 'The emotional turning point',
          guidance:
            'A powerful insight, truth, or reframe expressed as a quote. If attributable (person, source, brand voice), include attribution. This is the scene viewers screenshot. Max 200 chars.',
        },
        {
          position: 4,
          type: 'text-over-media',
          purpose: 'Deliver the resolution or takeaway',
          guidance:
            'Close the loop opened by the hook. One clear, actionable or inspiring sentence. Max 150 chars.',
        },
        {
          position: 'last',
          type: 'cta-card',
          purpose: 'Invite engagement',
          guidance:
            'Drive a comment or share — "Does this resonate?", "Share with someone who needs this", "Save for when you need it". Max 60 chars.',
        },
      ],
      captionStyle:
        'Narrative paragraph in first or second person — tell a story, not a list. End with an open question to drive comments.',
      hashtagCount: '8-12 hashtags — emotional/topic mix',
    },
  },
]

/**
 * Seeds platform-default templates for a given brand.
 * Templates are workspace-scoped so all brands in the workspace can use them.
 * Uses upsert on (brandId + name) to be safe to re-run.
 */
export async function seedTemplatesForBrand(prisma: PrismaClient, brandId: string): Promise<void> {
  for (const template of PLATFORM_TEMPLATES) {
    const existing = await prisma.template.findFirst({
      where: { brandId, name: template.name },
    })

    if (existing) {
      console.log(`  ↳ Template already exists: "${template.name}" — skipping`)
      continue
    }

    await prisma.template.create({
      data: {
        brandId,
        name: template.name,
        remotionId: template.remotionId,
        sceneType: template.sceneType,
        scope: template.scope,
        systemPrompt: template.systemPrompt,
        contentSchema: template.contentSchema,
        useBrandAssets: true,
      },
    })

    // Enable for the brand by default
    const created = await prisma.template.findFirst({
      where: { brandId, name: template.name },
    })
    if (created) {
      await prisma.brandTemplateConfig.upsert({
        where: { brandId_templateId: { brandId, templateId: created.id } },
        create: { brandId, templateId: created.id, enabled: true },
        update: { enabled: true },
      })
    }

    console.log(`  ✓ Seeded template: "${template.name}" (${template.sceneType})`)
  }
}
