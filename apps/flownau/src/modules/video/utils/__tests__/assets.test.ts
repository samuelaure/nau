import { describe, it, expect, vi } from 'vitest'
import { getDeterministicLibrary, applyLibraryAssets, clampMediaOffsets } from '../assets'

describe('Asset Utilities', () => {
  const mockAssets = [
    { url: 'v1.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v1.mp4' },
    { url: 'v2.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v2.mp4' },
    { url: 'v3.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v3.mp4' },
    { url: 'v4.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v4.mp4' },
    { url: 'v5.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v5.mp4' },
    { url: 'v6.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v6.mp4' },
    { url: 'v7.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v7.mp4' },
    { url: 'v8.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v8.mp4' },
    { url: 'v9.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v9.mp4' },
    { url: 'v10.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'assets/v10.mp4' },
    { url: 'a1.mp3', type: 'AUD', mimeType: 'audio/mp3', duration: 60, r2Key: 'assets/a1.mp3' },
    { url: 'out.mp4', type: 'VID', mimeType: 'video/mp4', duration: 10, r2Key: 'outputs/out.mp4' },
  ]

  describe('getDeterministicLibrary', () => {
    it('returns exactly 9 video assets from a larger list, excluding outputs', () => {
      const videos = getDeterministicLibrary(mockAssets, 'video')
      expect(videos).toHaveLength(9)
      expect(videos.every((v) => v.url.startsWith('v'))).toBe(true)
      expect(videos.some((v) => v.url === 'v10.mp4')).toBe(false) // Sliced off
      expect(videos.some((v) => v.url === 'out.mp4')).toBe(false) // Filtered out
    })

    it('returns audio assets correctly', () => {
      const audio = getDeterministicLibrary(mockAssets, 'audio')
      expect(audio).toHaveLength(1)
      expect(audio[0].url).toBe('a1.mp3')
    })
  })

  describe('applyLibraryAssets', () => {
    it('maps library assets to the schema slots', () => {
      const schema = {
        fps: 30,
        tracks: {
          media: [{ assetUrl: 'placeholder', durationInFrames: 150 }],
          audio: [{ assetUrl: 'placeholder', durationInFrames: 150 }],
        },
      }
      const result = applyLibraryAssets(schema, mockAssets)

      expect(result.tracks.media[0].assetUrl).not.toBe('placeholder')
      expect(result.tracks.media[0].assetUrl).toMatch(/v\d.mp4/)
      expect(result.tracks.audio[0].assetUrl).toBe('a1.mp3')
    })

    it('randomizes mediaStartAt within bounds', () => {
      const schema = {
        fps: 30,
        tracks: {
          media: [{ assetUrl: 'v1.mp4', durationInFrames: 150 }], // 5 seconds
        },
      }
      // v1.mp4 has 10s duration. mediaStartAt should be between 0 and 5s (0-150 frames)
      const result = applyLibraryAssets(schema, mockAssets)
      expect(result.tracks.media[0].mediaStartAt).toBeGreaterThanOrEqual(0)
      expect(result.tracks.media[0].mediaStartAt).toBeLessThanOrEqual(150)
    })
  })

  describe('clampMediaOffsets', () => {
    it('clamps offsets that exceed asset duration', () => {
      const schema = {
        fps: 30,
        tracks: {
          media: [{ assetUrl: 'v1.mp4', durationInFrames: 150, mediaStartAt: 300 }], // Start at 10s, but asset is only 10s long
        },
      }
      // v1.mp4 is 10s. Require 5s. Max start is 5s (150 frames).
      const result = clampMediaOffsets(schema, mockAssets)
      expect(result.tracks.media[0].mediaStartAt).toBe(150)
    })
  })
})
