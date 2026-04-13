import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

/**
 * TransitionScene — short fade-to-black visual breather.
 * No content slots. Duration: typically 0.5-1 second.
 */
export const TransitionScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const midpoint = Math.floor(durationInFrames / 2)

  // Fade to black, then fade back out
  const opacity = interpolate(frame, [0, midpoint, durationInFrames], [0, 1, 0], {
    extrapolateRight: 'clamp',
  })

  return <AbsoluteFill style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }} />
}
