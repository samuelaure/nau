import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export interface DarkOverlayProps {
  color?: string
  opacity?: number
  fadeIn?: boolean
}

/**
 * DarkOverlay — darkens the background for text readability.
 * Optional fade-in animation synchronized with scene entrance.
 */
export const DarkOverlay: React.FC<DarkOverlayProps> = ({
  color = '#000000',
  opacity = 0.4,
  fadeIn = true,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)

  const animatedOpacity = fadeIn
    ? interpolate(frame, [0, fps * 0.3], [0, opacity], { extrapolateRight: 'clamp' })
    : opacity

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${animatedOpacity})`,
      }}
    />
  )
}
