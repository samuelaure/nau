import React, { useMemo } from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { TypographyNodeSchemaType } from '../schema'

export type ResponsiveTextNodeProps = {
  node: TypographyNodeSchemaType
}

export const ResponsiveTextNode: React.FC<ResponsiveTextNodeProps> = ({ node }) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  // 1. Safe Margins Enforcement (Instagram Reels / TikTok UI safety boundaries)
  let justifyContent = 'center'
  let paddingTop = '0'
  let paddingBottom = '0'

  if (node.safeZone === 'top-third') {
    justifyContent = 'flex-start'
    paddingTop = '18%' // Stay below the notch, top icons, and following/for you tabs
  } else if (node.safeZone === 'bottom-third') {
    justifyContent = 'flex-end'
    paddingBottom = '35%' // Stay above the heavy caption, music bar, and engagement icons
  }

  // 2. Intelligent Font Scaling Engine based on character length.
  // The provided AI config size is a desired baseline.
  // If the agent sends back a heavy paragraph, we actively scale it down
  // to avoid bleeding outside the safe max-width container bounds.
  const charCount = (node.content || '').length

  const calculatedFontSize = useMemo(() => {
    let baseSize = node.fontSize || 60

    // Scale down text proportionally if it's exceptionally long
    if (charCount > 150) baseSize *= 0.5
    else if (charCount > 90) baseSize *= 0.65
    else if (charCount > 40) baseSize *= 0.8

    // Enforce a hard minimum floor so it remains physically readable on mobile devices
    return Math.max(30, baseSize)
  }, [charCount, node.fontSize])

  // 3. Animation logic calculations
  let opacity = 1
  let transform = 'none'

  if (node.animation === 'fade') {
    opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
      extrapolateRight: 'clamp',
    })
  } else if (node.animation === 'slide-up') {
    const yOffset = interpolate(frame, [0, fps * 0.5], [50, 0], {
      extrapolateRight: 'clamp',
    })
    opacity = interpolate(frame, [0, Math.min(fps * 0.5, 10)], [0, 1], {
      extrapolateRight: 'clamp',
    })
    transform = `translateY(${yOffset}px)`
  } else if (node.animation === 'pop') {
    const scale = interpolate(frame, [0, Math.min(fps * 0.3, 10)], [0.5, 1], {
      extrapolateRight: 'clamp',
    })
    opacity = interpolate(frame, [0, Math.min(fps * 0.3, 10)], [0, 1], {
      extrapolateRight: 'clamp',
    })
    transform = `scale(${scale})`
  }

  // Calculate dynamic maximum width enforcement
  const maxWidthAllowed = width * 0.85 // Keep text inside 85% of screen width always

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent,
        alignItems: 'center',
        paddingLeft: '7.5%', // 7.5% margin on both sides = 85% max width
        paddingRight: '7.5%',
        paddingTop,
        paddingBottom,
      }}
    >
      <div
        style={{
          color: node.color,
          fontSize: `${calculatedFontSize}px`,
          fontFamily: node.fontFamily || 'sans-serif',
          fontWeight: '900', // Extra bold handles video compression better
          textAlign: 'center',
          opacity,
          transform,
          maxWidth: maxWidthAllowed,
          wordWrap: 'break-word',
          whiteSpace: 'pre-line', // Allow AI to send explicit break lines via \n
          // Drop shadow to ensure readability on unknown dynamic video backgrounds
          textShadow: '0px 4px 20px rgba(0, 0, 0, 0.8), 0px 1px 4px rgba(0,0,0,0.5)',
          lineHeight: '1.2',
        }}
      >
        {node.content}
      </div>
    </div>
  )
}
