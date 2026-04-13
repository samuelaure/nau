import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'
import type { DynamicCompositionSchemaType } from '@/modules/rendering/DynamicComposition/schema'
import { getSceneDefaults } from '@/modules/scenes/scene-registry'
import type { CreativeDirection, ResolvedScene, AudioConfig, BrandStyle } from '@/types/scenes'
import type { ContentFormat } from '@/types/content'
import type { Asset } from '@prisma/client'

// ─── Constants ─────────────────────────────────────────────────────

const DEFAULT_FPS = 30
const DEFAULT_REEL_DURATION_SEC = 15
const DEFAULT_WIDTH = 1080
const DEFAULT_HEIGHT = 1920

// ─── Public API ────────────────────────────────────────────────────

export interface CompileResult {
  schema: DynamicCompositionSchemaType
  resolvedScenes: ResolvedScene[]
  audio: AudioConfig | null
}

/**
 * TimelineCompiler — deterministic frame math.
 *
 * Takes AI creative direction + resolved assets and compiles a valid
 * DynamicCompositionSchema. This function is GUARANTEED to produce valid
 * output — if it throws, it's a bug in the compiler, never an AI issue.
 *
 * Algorithm:
 * 1. Determine total duration from audio or default
 * 2. Distribute scene durations proportionally
 * 3. Calculate frame positions sequentially
 * 4. Resolve media offsets (random within safe range)
 * 5. Compile tracks: media[], text[], overlay[], audio[]
 * 6. Validate with DynamicCompositionSchema.parse()
 */
export function compileTimeline(
  creative: CreativeDirection,
  sceneAssets: Map<number, Asset>,
  audioAsset: Asset | null,
  brandStyle: BrandStyle,
  format: ContentFormat,
): CompileResult {
  const fps = DEFAULT_FPS

  // 1. Determine total duration
  let totalDurationSec: number
  if (audioAsset?.duration) {
    totalDurationSec = audioAsset.duration
  } else {
    totalDurationSec = DEFAULT_REEL_DURATION_SEC
  }

  const totalDurationFrames = Math.round(totalDurationSec * fps)

  // 2. Distribute scene durations
  const sceneDurations = distributeSceneDurations(creative, totalDurationSec, fps)

  // 3. Calculate frame positions and build ResolvedScenes
  const resolvedScenes: ResolvedScene[] = []
  let currentFrame = 0

  for (let i = 0; i < creative.scenes.length; i++) {
    const scene = creative.scenes[i]
    const durationInFrames = sceneDurations[i]
    const asset = sceneAssets.get(i) ?? null

    // 4. Resolve media offset
    let resolvedAsset: ResolvedScene['asset'] = null
    if (asset) {
      const durationSec = durationInFrames / fps
      const maxStartSec = asset.duration
        ? Math.max(0, asset.duration - durationSec - 0.5)
        : 0
      const mediaStartAt = Math.floor(Math.random() * maxStartSec * fps)

      const isVideo = asset.type.toUpperCase().startsWith('VID')
      resolvedAsset = {
        url: asset.url,
        mediaStartAt,
        type: isVideo ? 'video' : 'image',
      }
    }

    resolvedScenes.push({
      type: scene.type,
      slots: scene.slots as Record<string, unknown>,
      startFrame: currentFrame,
      durationInFrames,
      asset: resolvedAsset,
    })

    currentFrame += durationInFrames
  }

  // 5. Build audio config
  let audio: AudioConfig | null = null
  if (audioAsset) {
    audio = {
      url: audioAsset.url,
      volume: 0.8,
      startFrom: 0,
      durationInFrames: totalDurationFrames,
    }
  }

  // 6. Compile into DynamicCompositionSchema (for backward compat with renderer)
  const schema = compileToDynamicSchema(resolvedScenes, audio, brandStyle, fps, totalDurationFrames)

  return { schema, resolvedScenes, audio }
}

// ─── Duration Distribution ─────────────────────────────────────────

/**
 * Distributes total duration across scenes proportionally to their defaults,
 * while respecting min/max constraints per scene type.
 */
function distributeSceneDurations(
  creative: CreativeDirection,
  totalDurationSec: number,
  fps: number,
): number[] {
  const scenes = creative.scenes

  // Get defaults for each scene
  const defaults = scenes.map((s) => {
    const d = getSceneDefaults(s.type)
    return {
      defaultSec: s.duration ?? d.defaultDurationSec,
      minSec: d.minDurationSec,
      maxSec: d.maxDurationSec,
    }
  })

  // Sum of default durations
  const sumDefaults = defaults.reduce((sum, d) => sum + d.defaultSec, 0)

  // Scale factor to fit total duration
  const scaleFactor = totalDurationSec / sumDefaults

  // Scale and clamp
  const scaledSec = defaults.map((d) => {
    const scaled = d.defaultSec * scaleFactor
    return Math.max(d.minSec, Math.min(d.maxSec, scaled))
  })

  // Redistribute remainder to longest scene
  const currentTotal = scaledSec.reduce((sum, s) => sum + s, 0)
  const remainder = totalDurationSec - currentTotal

  if (Math.abs(remainder) > 0.1) {
    // Find the longest non-transition scene to absorb remainder
    let longestIdx = 0
    let longestDur = 0
    for (let i = 0; i < scaledSec.length; i++) {
      if (scenes[i].type !== 'transition' && scaledSec[i] > longestDur) {
        longestDur = scaledSec[i]
        longestIdx = i
      }
    }

    const adjusted = scaledSec[longestIdx] + remainder
    const d = defaults[longestIdx]
    scaledSec[longestIdx] = Math.max(d.minSec, Math.min(d.maxSec, adjusted))
  }

  // Convert to frames (round to nearest, ensure minimum 1 frame)
  return scaledSec.map((sec) => Math.max(1, Math.round(sec * fps)))
}

// ─── Schema Compilation ────────────────────────────────────────────

/**
 * Compiles resolved scenes into a DynamicCompositionSchemaType.
 * This bridges the new scene system to the existing renderer infrastructure.
 */
function compileToDynamicSchema(
  scenes: ResolvedScene[],
  audio: AudioConfig | null,
  brandStyle: BrandStyle,
  fps: number,
  totalDurationFrames: number,
): DynamicCompositionSchemaType {
  const mediaNodes: Array<{
    id: string
    type: 'media'
    assetUrl: string
    startFrame: number
    durationInFrames: number
    mediaStartAt: number
    scale: 'cover' | 'contain'
  }> = []

  const textNodes: Array<{
    id: string
    type: 'text'
    content: string
    startFrame: number
    durationInFrames: number
    safeZone: 'top-third' | 'center-safe' | 'bottom-third'
    color: string
    fontSize: number
    animation: 'fade' | 'pop' | 'slide-up' | 'none'
    fontFamily?: string
  }> = []

  const overlayNodes: Array<{
    id: string
    type: 'overlay'
    color: string
    opacity: number
    startFrame: number
    durationInFrames: number
  }> = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const slots = scene.slots

    // Add media node if scene has an asset
    if (scene.asset) {
      mediaNodes.push({
        id: `media-${i}`,
        type: 'media',
        assetUrl: scene.asset.url,
        startFrame: scene.startFrame,
        durationInFrames: scene.durationInFrames,
        mediaStartAt: scene.asset.mediaStartAt,
        scale: 'cover',
      })

      // Add overlay for scenes with text over media
      if (scene.type !== 'media-only') {
        overlayNodes.push({
          id: `overlay-${i}`,
          type: 'overlay',
          color: '#000000',
          opacity: scene.type === 'quote-card' ? 0.6 : 0.45,
          startFrame: scene.startFrame,
          durationInFrames: scene.durationInFrames,
        })
      }
    }

    // Add text nodes based on scene type
    const textContent = extractTextContent(scene.type, slots)
    if (textContent) {
      textNodes.push({
        id: `text-${i}`,
        type: 'text',
        content: textContent,
        startFrame: scene.startFrame,
        durationInFrames: scene.durationInFrames,
        safeZone: 'center-safe',
        color: '#FFFFFF',
        fontSize: scene.type === 'hook-text' ? 80 : 60,
        animation: scene.type === 'hook-text' ? 'pop' : scene.type === 'cta-card' ? 'slide-up' : 'fade',
        fontFamily: brandStyle.fontFamily,
      })
    }
  }

  // Build audio nodes
  const audioNodes: Array<{
    id: string
    type: 'audio'
    assetUrl: string
    startFrame: number
    durationInFrames: number
    mediaStartAt: number
    volume: number
  }> = []

  if (audio) {
    audioNodes.push({
      id: 'audio-main',
      type: 'audio',
      assetUrl: audio.url,
      startFrame: 0,
      durationInFrames: audio.durationInFrames,
      mediaStartAt: audio.startFrom,
      volume: audio.volume,
    })
  }

  const raw = {
    format: 'reel' as const,
    fps,
    durationInFrames: totalDurationFrames,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    tracks: {
      overlay: overlayNodes,
      media: mediaNodes,
      text: textNodes,
      audio: audioNodes,
    },
  }

  // GUARANTEE: this must always pass. If it throws, the compiler has a bug.
  return DynamicCompositionSchema.parse(raw)
}

/**
 * Extracts the primary text content from scene slots for the legacy text track.
 */
function extractTextContent(
  type: string,
  slots: Record<string, unknown>,
): string | null {
  switch (type) {
    case 'hook-text':
      return (slots.hook as string) ?? null
    case 'text-over-media':
      return (slots.text as string) ?? null
    case 'quote-card': {
      const quote = (slots.quote as string) ?? ''
      const attr = (slots.attribution as string) ?? ''
      return attr ? `"${quote}"\n— ${attr}` : `"${quote}"`
    }
    case 'list-reveal': {
      const title = (slots.title as string) ?? ''
      const items = (slots.items as string[]) ?? []
      const body = items.map((item) => `• ${item}`).join('\n')
      return title ? `${title}\n\n${body}` : body
    }
    case 'cta-card': {
      const cta = (slots.cta as string) ?? ''
      const handle = (slots.handle as string) ?? ''
      return handle ? `${cta}\n${handle}` : cta
    }
    default:
      return null
  }
}
