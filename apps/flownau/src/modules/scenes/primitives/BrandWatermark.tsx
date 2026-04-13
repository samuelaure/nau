import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export interface BrandWatermarkProps {
  handle: string
  position?: 'bottom-left' | 'bottom-right'
  opacity?: number
  fontSize?: number
}

/**
 * BrandWatermark — subtle brand handle overlay in a corner.
 * Fades in gently to avoid distracting from main content.
 */
export const BrandWatermark: React.FC<BrandWatermarkProps> = ({
  handle,
  position = 'bottom-right',
  opacity = 0.3,
  fontSize = 14,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const fadeOpacity = interpolate(frame, [fps * 0.5, fps * 1], [0, opacity], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const positionStyle: React.CSSProperties =
    position === 'bottom-left'
      ? { bottom: '8%', left: '5%' }
      : { bottom: '8%', right: '5%' }

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyle,
        opacity: fadeOpacity,
        color: '#FFFFFF',
        fontSize,
        fontFamily: 'sans-serif',
        fontWeight: '600',
        letterSpacing: '0.05em',
        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        zIndex: 10,
      }}
    >
      {handle}
    </div>
  )
}
