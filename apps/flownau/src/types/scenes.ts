import { z } from 'zod'

// ─── Scene Type Unions ─────────────────────────────────────────────

/**
 * Video scene types — the building blocks of a Reel or Trial Reel.
 * Each maps to a Remotion component in the scene registry.
 */
export type VideoSceneType =
  | 'hook-text'
  | 'text-over-media'
  | 'quote-card'
  | 'list-reveal'
  | 'media-only'
  | 'cta-card'
  | 'transition'

export const VideoSceneTypeEnum = z.enum([
  'hook-text',
  'text-over-media',
  'quote-card',
  'list-reveal',
  'media-only',
  'cta-card',
  'transition',
])

/**
 * Image scene types — building blocks of Carousels and Single Images.
 * Each maps to a static Remotion component rendered as a still.
 */
export type ImageSceneType =
  | 'cover-slide'
  | 'content-slide'
  | 'quote-slide'
  | 'list-slide'
  | 'cta-slide'

export const ImageSceneTypeEnum = z.enum([
  'cover-slide',
  'content-slide',
  'quote-slide',
  'list-slide',
  'cta-slide',
])

/**
 * Union of all scene types (video + image).
 */
export type AnySceneType = VideoSceneType | ImageSceneType

export const AnySceneTypeEnum = z.enum([
  'hook-text',
  'text-over-media',
  'quote-card',
  'list-reveal',
  'media-only',
  'cta-card',
  'transition',
  'cover-slide',
  'content-slide',
  'quote-slide',
  'list-slide',
  'cta-slide',
])

// ─── Slot Schemas ──────────────────────────────────────────────────

export const HookTextSlots = z.object({
  hook: z.string().max(80),
})

export const TextOverMediaSlots = z.object({
  text: z.string().max(150),
})

export const QuoteCardSlots = z.object({
  quote: z.string().max(200),
  attribution: z.string().max(50).optional().nullable(),
})

export const ListRevealSlots = z.object({
  title: z.string().max(60).optional().nullable(),
  items: z.array(z.string().max(80)).min(2).max(5),
})

export const MediaOnlySlots = z.object({})

export const CTACardSlots = z.object({
  cta: z.string().max(60),
  handle: z.string().max(30).optional().nullable(),
})

export const TransitionSlots = z.object({})

// ─── Image Slot Schemas ────────────────────────────────────────────

export const CoverSlideSlots = z.object({
  title: z.string().max(80),
  subtitle: z.string().max(120).optional().nullable(),
})

export const ContentSlideSlots = z.object({
  heading: z.string().max(80),
  body: z.string().max(300),
})

export const QuoteSlideSlots = z.object({
  quote: z.string().max(200),
  attribution: z.string().max(50).optional().nullable(),
})

export const ListSlideSlots = z.object({
  title: z.string().max(60).optional().nullable(),
  items: z.array(z.string().max(80)).min(2).max(5),
})

export const CTASlideSlots = z.object({
  cta: z.string().max(60),
  handle: z.string().max(30).optional().nullable(),
})

// ─── Scene Definition (one element in the AI's output) ─────────────

export const SceneDefinitionSchema = z.object({
  type: VideoSceneTypeEnum,
  slots: z.record(z.string(), z.unknown()),
  mood: z.string().max(40).optional().nullable(),
  assetHint: z.string().max(80).optional().nullable(),
  duration: z.number().min(0.3).max(30).optional().nullable(),
})

export type SceneDefinition = z.infer<typeof SceneDefinitionSchema>

// ─── Creative Direction (full AI output) ───────────────────────────

export const CreativeDirectionSchema = z.object({
  scenes: z.array(SceneDefinitionSchema).min(2).max(15),
  caption: z.string().max(2200),
  hashtags: z.array(z.string().max(60)).min(1).max(20),
  coverSceneIndex: z.number().int().min(0),
  suggestedAudioMood: z.string().max(40).optional().nullable(),
})

export type CreativeDirection = z.infer<typeof CreativeDirectionSchema>

// ─── Brand Style (passed to every scene component) ─────────────────

export interface BrandStyle {
  primaryColor: string
  accentColor: string
  fontFamily: string
}

// ─── Resolved Scene (after asset curation, ready for render) ───────

export interface ResolvedScene {
  type: VideoSceneType
  slots: Record<string, unknown>
  startFrame: number
  durationInFrames: number
  asset: {
    url: string
    mediaStartAt: number
    type: 'video' | 'image'
  } | null
}

export interface AudioConfig {
  url: string
  volume: number
  startFrom: number
  durationInFrames: number
}

// ─── Scene Catalog (context given to the AI) ───────────────────────

export interface SceneCatalogEntry {
  type: AnySceneType
  format: 'video' | 'image'
  description: string
  defaultDurationSec: number
  minDurationSec: number
  maxDurationSec: number
  slotDescription: string
}

/**
 * SCENE_CATALOG — the complete menu of scene types available to the AI.
 * Descriptions are crafted for the LLM to understand purpose and constraints.
 */
export const SCENE_CATALOG: SceneCatalogEntry[] = [
  // ─── Video Scenes ──────────────────────────────────────────
  {
    type: 'hook-text',
    format: 'video',
    description:
      'Bold text on a gradient background. NO B-roll. Used to grab attention in the first 1-2 seconds. Uses brand primary color.',
    defaultDurationSec: 2,
    minDurationSec: 1,
    maxDurationSec: 4,
    slotDescription: 'hook: string (max 80 chars) — the attention-grabbing opening line',
  },
  {
    type: 'text-over-media',
    format: 'video',
    description:
      'Text overlaid on B-roll video. PRIMARY scene type for Reels. Uses dark overlay for readability. Best for delivering key points over engaging footage.',
    defaultDurationSec: 3,
    minDurationSec: 2,
    maxDurationSec: 6,
    slotDescription: 'text: string (max 150 chars) — the key message displayed over the video',
  },
  {
    type: 'quote-card',
    format: 'video',
    description:
      'Centered quote with decorative border lines. Optional attribution. Can have dimmed B-roll background. Great for testimonials, stats, or powerful statements.',
    defaultDurationSec: 3.5,
    minDurationSec: 2.5,
    maxDurationSec: 6,
    slotDescription: 'quote: string (max 200 chars), attribution?: string (max 50 chars)',
  },
  {
    type: 'list-reveal',
    format: 'video',
    description:
      'Items appear one by one with staggered animation. Great for tips, steps, or benefits. Each item gets equal screen time within the scene.',
    defaultDurationSec: 4,
    minDurationSec: 3,
    maxDurationSec: 8,
    slotDescription:
      'title?: string (max 60 chars), items: string[] (2-5 items, max 80 chars each)',
  },
  {
    type: 'media-only',
    format: 'video',
    description:
      'Full-screen B-roll video with NO text. Visual breathing room between text-heavy scenes. Use to showcase products, environments, or create mood.',
    defaultDurationSec: 2,
    minDurationSec: 1,
    maxDurationSec: 5,
    slotDescription: '(no text slots — pure visual scene)',
  },
  {
    type: 'cta-card',
    format: 'video',
    description:
      'Call-to-action card. Used as the LAST scene. Brand gradient or dimmed B-roll background. CTA text centered, optional brand handle at bottom.',
    defaultDurationSec: 2.5,
    minDurationSec: 2,
    maxDurationSec: 4,
    slotDescription: 'cta: string (max 60 chars), handle?: string (max 30 chars — e.g. @yourbrand)',
  },
  {
    type: 'transition',
    format: 'video',
    description:
      'Short fade-to-black visual breather. No content. Used sparingly between major sections. Keep under 1 second.',
    defaultDurationSec: 0.5,
    minDurationSec: 0.3,
    maxDurationSec: 1.5,
    slotDescription: '(no slots — pure transition)',
  },
  // ─── Image Scenes (Carousel / Single Image) ────────────────
  {
    type: 'cover-slide',
    format: 'image',
    description:
      'First slide of a carousel. Bold title with optional subtitle on brand gradient background. Sets the topic and hooks the swipe.',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
    slotDescription: 'title: string (max 80 chars), subtitle?: string (max 120 chars)',
  },
  {
    type: 'content-slide',
    format: 'image',
    description:
      'Educational content slide. Heading at top, body text in center, accent separator line. Use for explaining points in detail.',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
    slotDescription: 'heading: string (max 80 chars), body: string (max 300 chars)',
  },
  {
    type: 'quote-slide',
    format: 'image',
    description:
      'Stylized quote with decorative quotation marks. Centered text with optional attribution. Great for impactful statements.',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
    slotDescription: 'quote: string (max 200 chars), attribution?: string (max 50 chars)',
  },
  {
    type: 'list-slide',
    format: 'image',
    description:
      'Numbered list with accent-colored numbers. Optional title. Clean spacing. Best for tips, steps, or benefits.',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
    slotDescription:
      'title?: string (max 60 chars), items: string[] (2-5 items, max 80 chars each)',
  },
  {
    type: 'cta-slide',
    format: 'image',
    description:
      'Final carousel slide. Call-to-action with optional brand handle. Brand gradient background. Always the last slide.',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
    slotDescription: 'cta: string (max 60 chars), handle?: string (max 30 chars)',
  },
]

/**
 * Formats the scene catalog as a string for the AI system prompt.
 * Filters by format so the AI only sees relevant scenes.
 */
export function formatSceneCatalogForAI(format: 'video' | 'image' = 'video'): string {
  return SCENE_CATALOG.filter((s) => s.format === format)
    .map((s) => {
      if (format === 'video') {
        return `- ${s.type}: ${s.description}\n  Duration: ${s.minDurationSec}-${s.maxDurationSec}s (default: ${s.defaultDurationSec}s)\n  Slots: ${s.slotDescription}`
      }
      return `- ${s.type}: ${s.description}\n  Slots: ${s.slotDescription}`
    })
    .join('\n\n')
}

/**
 * Gets catalog entry for a scene type.
 */
export function getSceneCatalogEntry(type: AnySceneType): SceneCatalogEntry {
  const entry = SCENE_CATALOG.find((s) => s.type === type)
  if (!entry) throw new Error(`Unknown scene type: ${type}`)
  return entry
}
