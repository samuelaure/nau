import React from 'react'
import { OffthreadVideo, Img, AbsoluteFill } from 'remotion'

export interface MediaBackgroundProps {
  assetUrl: string
  mediaStartAt?: number
  scale?: 'cover' | 'contain'
  type?: 'video' | 'image'
}

/**
 * MediaBackground — renders a full-screen video or image background.
 *
 * Auto-detects media type from URL extension if `type` is not specified.
 * Uses OffthreadVideo for remote video URLs (better frame accuracy).
 * Migrated from ResponsiveMediaNode.tsx.
 */
export const MediaBackground: React.FC<MediaBackgroundProps> = ({
  assetUrl,
  mediaStartAt = 0,
  scale = 'cover',
  type,
}) => {
  if (!assetUrl || assetUrl === 'placeholder') {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#1E1E2E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff33',
          fontFamily: 'sans-serif',
          fontSize: 24,
        }}
      >
        No Media
      </AbsoluteFill>
    )
  }

  const isVideo =
    type === 'video' ||
    (!type && detectVideoUrl(assetUrl))

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: scale,
  }

  if (isVideo) {
    return <OffthreadVideo src={assetUrl} style={style} startFrom={mediaStartAt} volume={0} />
  }

  return <Img src={assetUrl} style={style} />
}

function detectVideoUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('.mp4') ||
    lower.includes('.mov') ||
    lower.includes('.webm') ||
    lower.includes('/video/')
  )
}
