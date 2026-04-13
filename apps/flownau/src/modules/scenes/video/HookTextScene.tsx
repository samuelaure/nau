import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { SafeText } from '../primitives/SafeText'
import type { BrandStyle } from '@/types/scenes'

export interface HookTextSceneProps {
  slots: { hook: string }
  brandStyle: BrandStyle
}

/**
 * HookTextScene — bold text on gradient background. No B-roll.
 * Purpose: Grab attention in the first 1-2 seconds.
 */
export const HookTextScene: React.FC<HookTextSceneProps> = ({ slots, brandStyle }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const bgOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill>
      {/* Gradient background using brand colors */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${brandStyle.primaryColor} 0%, ${brandStyle.accentColor} 100%)`,
          opacity: bgOpacity,
        }}
      />
      <SafeText
        text={slots.hook}
        fontSize={80}
        color="#FFFFFF"
        fontFamily={brandStyle.fontFamily}
        safeZone="center-safe"
        animation="pop"
      />
    </AbsoluteFill>
  )
}
