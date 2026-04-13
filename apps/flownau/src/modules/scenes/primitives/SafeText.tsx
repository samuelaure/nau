import React, { useMemo } from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export interface SafeTextProps {
  text: string
  fontSize?: number
  color?: string
  fontFamily?: string
  fontWeight?: string
  safeZone?: 'top-third' | 'center-safe' | 'bottom-third'
  animation?: 'fade' | 'pop' | 'slide-up' | 'none'
  maxWidth?: number
  textAlign?: 'center' | 'left' | 'right'
}

/**
 * SafeText — the universal text primitive for all scene components.
 *
 * Features:
 * - Automatic font scaling based on character count
 * - Instagram/TikTok safe zone enforcement
 * - Animation support (fade, pop, slide-up)
 * - Text shadow for video readability
 *
 * Migrated and enhanced from ResponsiveTextNode.tsx.
 */
export const SafeText: React.FC<SafeTextProps> = ({
  text,
  fontSize = 60,
  color = '#FFFFFF',
  fontFamily = 'sans-serif',
  fontWeight = '900',
  safeZone = 'center-safe',
  animation = 'fade',
  maxWidth,
  textAlign = 'center',
}) => {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  // Safe zone positioning
  let justifyContent: React.CSSProperties['justifyContent'] = 'center'
  let paddingTop = '0'
  let paddingBottom = '0'

  if (safeZone === 'top-third') {
    justifyContent = 'flex-start'
    paddingTop = '18%'
  } else if (safeZone === 'bottom-third') {
    justifyContent = 'flex-end'
    paddingBottom = '35%'
  }

  // Intelligent font scaling based on character count
  const charCount = (text || '').length
  const calculatedFontSize = useMemo(() => {
    let baseSize = fontSize
    if (charCount > 150) baseSize *= 0.5
    else if (charCount > 90) baseSize *= 0.65
    else if (charCount > 40) baseSize *= 0.8
    return Math.max(28, baseSize)
  }, [charCount, fontSize])

  // Animation
  let opacity = 1
  let transform = 'none'

  if (animation === 'fade') {
    opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
      extrapolateRight: 'clamp',
    })
  } else if (animation === 'slide-up') {
    const yOffset = interpolate(frame, [0, fps * 0.5], [50, 0], {
      extrapolateRight: 'clamp',
    })
    opacity = interpolate(frame, [0, Math.min(fps * 0.5, 10)], [0, 1], {
      extrapolateRight: 'clamp',
    })
    transform = `translateY(${yOffset}px)`
  } else if (animation === 'pop') {
    const scale = interpolate(frame, [0, Math.min(fps * 0.3, 10)], [0.5, 1], {
      extrapolateRight: 'clamp',
    })
    opacity = interpolate(frame, [0, Math.min(fps * 0.3, 10)], [0, 1], {
      extrapolateRight: 'clamp',
    })
    transform = `scale(${scale})`
  }

  const maxWidthAllowed = maxWidth ?? width * 0.85

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent,
        alignItems: 'center',
        paddingLeft: '7.5%',
        paddingRight: '7.5%',
        paddingTop,
        paddingBottom,
        isolation: 'isolate',
      }}
    >
      <div
        style={{
          color,
          fontSize: `${calculatedFontSize}px`,
          fontFamily,
          fontWeight,
          textAlign,
          opacity,
          transform,
          maxWidth: maxWidthAllowed,
          wordWrap: 'break-word',
          whiteSpace: 'pre-line',
          textShadow: '0px 2px 8px rgba(0, 0, 0, 0.9), 0px 1px 2px rgba(0,0,0,0.7)',
          lineHeight: '1.2',
        }}
      >
        {text}
      </div>
    </div>
  )
}
