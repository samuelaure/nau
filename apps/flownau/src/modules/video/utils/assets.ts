import { Asset } from '@prisma/client'

/**
 * Shuffles an array in place.
 */
export const shuffle = <T>(array: T[]): T[] => {
  const list = [...array]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/**
 * Filter and slice deterministic assets for a brand or template.
 * Limits to max 9 items for caching efficiency.
 */
export const getDeterministicLibrary = (assets: any[], type: 'video' | 'audio') => {
  return assets
    .filter((a) => {
      const t = (a.type || '').toUpperCase()
      const m = (a.mimeType || '').toLowerCase()
      const lowerKey = (a.r2Key || '').toLowerCase()
      const lowerUrl = (a.url || '').toLowerCase()
      const isOutput = lowerKey.includes('/outputs/') || lowerUrl.includes('/outputs/')

      if (isOutput) return false

      if (type === 'video') {
        return (
          t === 'VID' ||
          t === 'IMG' ||
          t.includes('VIDEO') ||
          t.includes('IMAGE') ||
          m.startsWith('video') ||
          m.startsWith('image')
        )
      } else {
        return (
          t === 'AUD' ||
          t.includes('AUDIO') ||
          m.startsWith('audio') ||
          a.url?.toLowerCase().endsWith('.mp3') ||
          a.url?.toLowerCase().endsWith('.wav')
        )
      }
    })
    .slice(0, 9)
}

/**
 * Applies shuffled assets to a schema JSON.
 */
export const applyLibraryAssets = (json: any, initialAssets: any[]) => {
  const next = JSON.parse(JSON.stringify(json))

  const videoLibrary = shuffle(getDeterministicLibrary(initialAssets, 'video'))
  const audioLibrary = shuffle(getDeterministicLibrary(initialAssets, 'audio'))

  if (next.tracks?.media && videoLibrary.length > 0) {
    next.tracks.media = next.tracks.media.map((t: any, i: number) => {
      const asset = videoLibrary[i % videoLibrary.length]
      let mediaStartAt = t.mediaStartAt || 0
      if (asset.duration) {
        const fps = next.fps || 30
        const requireFrames = t.durationInFrames || 0
        const requireSec = requireFrames / fps
        const maxStartSec = Math.max(0, asset.duration - requireSec)
        if (maxStartSec > 0) {
          mediaStartAt = Math.floor(Math.random() * maxStartSec * fps)
        }
      }
      return { ...t, assetUrl: asset.url, mediaStartAt }
    })
  }

  if (next.tracks?.audio && audioLibrary.length > 0) {
    next.tracks.audio = next.tracks.audio.map((t: any, i: number) => {
      const asset = audioLibrary[i % audioLibrary.length]
      let mediaStartAt = t.mediaStartAt || 0
      if (asset.duration) {
        const fps = next.fps || 30
        const requireFrames = t.durationInFrames || 0
        const requireSec = requireFrames / fps
        const maxStartSec = Math.max(0, asset.duration - requireSec)
        if (maxStartSec > 0) {
          mediaStartAt = Math.floor(Math.random() * maxStartSec * fps)
        }
      }
      return { ...t, assetUrl: asset.url, mediaStartAt }
    })
  }

  return next
}

/**
 * Clamps media offsets to ensure they don't exceed asset duration.
 */
export const clampMediaOffsets = (json: any, initialAssets: any[]) => {
  const next = JSON.parse(JSON.stringify(json))
  const fps = next.fps || 30

  const processTrack = (track: any) => {
    const asset = initialAssets.find((a) => a.url === track.assetUrl)
    if (asset && asset.duration) {
      const requireFrames = track.durationInFrames || 0
      const requireSec = requireFrames / fps
      const totalSec = asset.duration
      const currentStartSec = (track.mediaStartAt || 0) / fps

      if (currentStartSec + requireSec > totalSec) {
        const newStartSec = Math.max(0, totalSec - requireSec)
        track.mediaStartAt = Math.floor(newStartSec * fps)
      }
    }
    return track
  }

  if (next.tracks?.media) next.tracks.media = next.tracks.media.map(processTrack)
  if (next.tracks?.audio) next.tracks.audio = next.tracks.audio.map(processTrack)

  return next
}
