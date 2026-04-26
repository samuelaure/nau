import { prisma } from '@/modules/shared/prisma'
import { logger } from '@/modules/shared/logger'
import type { CreativeDirection, SceneDefinition } from '@/types/scenes'
import type { Asset } from '@prisma/client'

// ─── Types ─────────────────────────────────────────────────────────

interface AssetCandidate extends Asset {
  score: number
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Selects a media asset for a scene based on type, duration, tags, and usage history.
 *
 * Selection algorithm:
 * 1. Filter by type (video for video scenes, image for image scenes)
 * 2. Filter by duration (asset must be >= required duration to avoid black frames)
 * 3. Exclude output assets (renders stored back in R2)
 * 4. Score: tagMatch + recencyPenalty + usagePenalty + randomFactor
 * 5. Pick top scorer
 *
 * Returns null if no assets pass filters (handled gracefully by caller).
 */
export function selectMediaForScene(
  scene: SceneDefinition,
  assetPool: Asset[],
  requiredDurationSec: number,
): Asset | null {
  const needsVideo = scene.type !== 'transition'
  const requiredType = needsVideo ? 'VID' : 'IMG'

  // Filter candidates
  const candidates: AssetCandidate[] = assetPool
    .filter((asset) => {
      // Type filter
      if (requiredType === 'VID' && !asset.type.toUpperCase().startsWith('VID')) return false
      if (requiredType === 'IMG' && !asset.type.toUpperCase().startsWith('IMG')) return false

      // Duration filter (videos only — images are infinite duration)
      if (requiredType === 'VID' && asset.duration != null) {
        if (asset.duration < requiredDurationSec) return false
      }

      // Exclude output renders
      if (asset.r2Key.includes('/outputs/')) return false

      return true
    })
    .map((asset) => ({ ...asset, score: 0 }))

  if (candidates.length === 0) {
    // Fallback: try images if no videos available
    if (requiredType === 'VID') {
      const imageFallback = assetPool.find(
        (a) => a.type.toUpperCase().startsWith('IMG') && !a.r2Key.includes('/outputs/'),
      )
      return imageFallback ?? null
    }
    return null
  }

  // Score each candidate
  const mood = scene.mood?.toLowerCase() ?? ''
  const hint = scene.assetHint?.toLowerCase() ?? ''

  for (const candidate of candidates) {
    let score = 0

    // Tag match score (0-30 points)
    if (mood || hint) {
      const tags = candidate.tags.map((t) => t.toLowerCase())
      for (const tag of tags) {
        if (mood && tag.includes(mood)) score += 15
        if (hint && tag.includes(hint)) score += 15
      }
    }

    // Recency penalty: recently used assets get lower scores (-0 to -10)
    if (candidate.lastUsedAt) {
      const hoursSinceUsed = (Date.now() - candidate.lastUsedAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceUsed < 24) score -= 10
      else if (hoursSinceUsed < 72) score -= 5
    }

    // Usage count penalty: heavily used assets get lower scores (-0 to -10)
    score -= Math.min(10, candidate.usageCount * 2)

    // Random factor (0-5) for variety
    score += Math.random() * 5

    candidate.score = score
  }

  // Sort by score descending, pick top
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]
}

/**
 * Selects an audio asset based on mood tag matching.
 * Returns null if no audio assets match (reels without audio are allowed).
 */
export function selectAudio(assetPool: Asset[], suggestedMood?: string): Asset | null {
  const audioAssets = assetPool.filter(
    (a) => a.type.toUpperCase().startsWith('AUD') && !a.r2Key.includes('/outputs/'),
  )

  if (audioAssets.length === 0) return null

  if (!suggestedMood) {
    // Pick least recently used audio
    return audioAssets.sort((a, b) => {
      const aTime = a.lastUsedAt?.getTime() ?? 0
      const bTime = b.lastUsedAt?.getTime() ?? 0
      return aTime - bTime
    })[0]
  }

  const moodLower = suggestedMood.toLowerCase()

  // Score by mood tag match + recency
  const scored = audioAssets.map((asset) => {
    let score = 0
    const tags = asset.tags.map((t) => t.toLowerCase())
    for (const tag of tags) {
      if (tag.includes(moodLower)) score += 20
    }
    // Recency bonus for less-used
    if (asset.lastUsedAt) {
      const hoursSince = (Date.now() - asset.lastUsedAt.getTime()) / (1000 * 60 * 60)
      if (hoursSince > 72) score += 5
    }
    score -= Math.min(5, asset.usageCount)
    score += Math.random() * 3
    return { asset, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0].asset
}

/**
 * Commits usage tracking for selected assets.
 * Called AFTER composition is successfully created (not during selection).
 */
export async function commitAssetUsage(assetIds: string[]): Promise<void> {
  const now = new Date()

  for (const id of assetIds) {
    try {
      await prisma.asset.update({
        where: { id },
        data: {
          lastUsedAt: now,
          usageCount: { increment: 1 },
        },
      })
    } catch (error: unknown) {
      // Non-fatal: log and continue
      const msg = error instanceof Error ? error.message : String(error)
      logger.warn(`[AssetCurator] Failed to update usage for asset ${id}: ${msg}`)
    }
  }
}

/**
 * Selects assets for all scenes in a creative direction.
 * Returns a map of sceneIndex → selected asset.
 */
export async function selectAssetsForCreative(
  creative: CreativeDirection,
  brandId: string,
  _fps: number,
): Promise<{
  sceneAssets: Map<number, Asset>
  audioAsset: Asset | null
}> {
  // Fetch full asset pool for this account
  const assetPool = await prisma.asset.findMany({
    where: { brandId },
  })

  const sceneAssets = new Map<number, Asset>()

  for (let i = 0; i < creative.scenes.length; i++) {
    const scene = creative.scenes[i]

    // Scenes that need media
    const needsMedia = scene.type !== 'hook-text' && scene.type !== 'transition'

    if (needsMedia) {
      const durationSec = scene.duration ?? 3
      const asset = selectMediaForScene(scene, assetPool, durationSec)
      if (asset) {
        sceneAssets.set(i, asset)
      }
    }
  }

  // Select audio
  const audioAsset = selectAudio(assetPool, creative.suggestedAudioMood ?? undefined)

  return { sceneAssets, audioAsset }
}
