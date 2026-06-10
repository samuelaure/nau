/**
 * Canonical TypeScript types for the block-based template builder.
 *
 * A template.scenes: SceneDef[] describes the full visual structure of a reel.
 * Each SceneDef has a background and an ordered list of TextDef blocks.
 *
 * At render time:
 *   - If a TextDef has mode='manual', content is used verbatim.
 *   - If mode='prompt', the AI generates text based on content as instructions.
 *   - Scene duration = sum of text block durations (450 wpm, min 1.5s each),
 *     OR the pinned background video duration if backgroundVideoAssetId is set.
 *   - Global reel duration cap: 3 minutes (5400 frames @ 30fps).
 */

export type TextStyle = 'none' | 'stroke' | 'background_block'
export type HorizontalAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'center' | 'bottom'
export type TextMode = 'prompt' | 'manual'

export interface TextDef {
  id: string // stable cuid — used as DnD key and AI slot key
  mode: TextMode // 'prompt' = AI fills; 'manual' = literal text
  content: string // prompt instructions OR literal text depending on mode
  font?: string | null // Google Font name, e.g. 'Anton'. null = brand titleFont
  color?: string | null // hex, e.g. '#ffffff'. null = brand primaryColor
  maxTextSize?: number | null // 10–100, percentage of base font size. null = brand maxTextSize
  textStyle: TextStyle
  styleColor: string // hex — color for stroke outline or background pill
  horizontalAlign: HorizontalAlign
  // Only relevant when mode='prompt'
  minWords?: number
  maxWords?: number
}

export interface SceneDef {
  id: string // stable cuid
  backgroundVideoAssetId?: string | null // null = random LRU selection at render
  backgroundVideoUrl?: string | null // cached CDN URL (for builder preview)
  backgroundVideoDurationSecs?: number | null // cached duration in seconds
  overlayColor?: string | null // hex, e.g. '#000000'. null = brand overlayColor
  overlayOpacity?: number | null // 0–1. null = brand overlayOpacity
  textVerticalAlign: VerticalAlign
  texts: TextDef[]
}

// ── Duration constants ─────────────────────────────────────────────────────────

export const READING_WPM = 324 // 180 wpm * 1.8 multiplier
export const MIN_TEXT_DURATION_SECS = 1.5
export const REMOTION_FPS = 30
export const MAX_REEL_DURATION_SECS = 180 // 3 minutes global cap
export const MAX_REEL_FRAMES = MAX_REEL_DURATION_SECS * REMOTION_FPS // 5400

/**
 * Duration in seconds for a single text block.
 * Based on 324 wpm reading speed (180 avg * 1.8) with a 1.5s minimum floor.
 */
export function calcTextDurationSecs(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const secs = (wordCount / READING_WPM) * 60
  return Math.max(secs, MIN_TEXT_DURATION_SECS)
}

/**
 * Duration in frames for a single text block.
 */
export function calcTextDurationFrames(text: string): number {
  return Math.round(calcTextDurationSecs(text) * REMOTION_FPS)
}

/**
 * Resolved display text for a TextDef or ResolvedTextDef.
 * Uses resolvedContent when present (post-AI), falls back to content.
 */
export function resolvedText(t: TextDef | ResolvedTextDef): string {
  return (t as ResolvedTextDef).resolvedContent ?? t.content
}

/**
 * Duration in frames for a scene.
 * If the scene has a pinned background video, returns that video's duration in frames.
 * Otherwise, sums the durations of all text blocks.
 */
export function calcSceneDurationFrames(scene: SceneDef): number {
  if (scene.backgroundVideoAssetId && scene.backgroundVideoDurationSecs) {
    return Math.round(scene.backgroundVideoDurationSecs * REMOTION_FPS)
  }
  if (scene.texts.length === 0) {
    return Math.round(MIN_TEXT_DURATION_SECS * REMOTION_FPS)
  }
  // Use resolvedContent when available (post-AI); fall back to content (template definition).
  // Critical: using t.content here for resolved scenes would compute duration from the
  // long prompt instruction, causing a timing mismatch with the render path which uses resolvedContent.
  return scene.texts.reduce((sum, t) => sum + calcTextDurationFrames(resolvedText(t)), 0)
}

/**
 * Total reel duration in frames, capped at MAX_REEL_FRAMES (3 min).
 */
export function calcTotalReelFrames(scenes: SceneDef[]): number {
  const adjusted = getAdjustedSceneDurations(scenes)
  const total = adjusted.reduce((sum, d) => sum + d, 0)
  return Math.min(total, MAX_REEL_FRAMES)
}

/**
 * Returns an array of durations (in frames) for each scene.
 * If the total duration is below 7 seconds, the remaining frames
 * are distributed equally across all scenes.
 */
export function getAdjustedSceneDurations(scenes: SceneDef[]): number[] {
  if (!scenes || scenes.length === 0) return []
  const baseDurations = scenes.map(calcSceneDurationFrames)
  const totalBase = baseDurations.reduce((sum, d) => sum + d, 0)
  
  const MIN_REEL_FRAMES = 7 * REMOTION_FPS
  if (totalBase < MIN_REEL_FRAMES) {
    const deficit = MIN_REEL_FRAMES - totalBase
    const addPerScene = Math.floor(deficit / scenes.length)
    let remainder = deficit % scenes.length
    
    return baseDurations.map(duration => {
      let adj = duration + addPerScene
      if (remainder > 0) {
        adj += 1
        remainder -= 1
      }
      return adj
    })
  }
  
  return baseDurations
}

// ── Resolved types (post-AI, post-asset-resolution) ───────────────────────────

export interface ResolvedTextDef extends TextDef {
  resolvedContent: string // AI output for 'prompt' mode; same as content for 'manual'
}

export interface ResolvedSceneDef extends Omit<SceneDef, 'texts'> {
  texts: ResolvedTextDef[]
  resolvedBackgroundVideoUrl?: string | null // final URL used at render time
  resolvedBrollStartFrom?: number // frame offset into the background video
}

// ── Default values (pre-filled from brand identity) ───────────────────────────

export const DEFAULT_TEXT_DEF: Omit<TextDef, 'id' | 'content'> = {
  mode: 'prompt',
  font: null,        // null = use brand titleFont at render time
  color: null,       // null = use brand primaryColor at render time
  maxTextSize: null, // null = use brand maxTextSize at render time
  textStyle: 'none',
  styleColor: '#000000',
  horizontalAlign: 'center',
  minWords: undefined,
  maxWords: undefined,
}

export const DEFAULT_SCENE_DEF: Omit<SceneDef, 'id' | 'texts'> = {
  backgroundVideoAssetId: null,
  backgroundVideoUrl: null,
  backgroundVideoDurationSecs: null,
  overlayColor: null,   // null = use brand overlayColor at render time
  overlayOpacity: null, // null = use brand overlayOpacity at render time
  textVerticalAlign: 'center',
}
