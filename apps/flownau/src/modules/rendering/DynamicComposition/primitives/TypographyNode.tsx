import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { TypographyNodeSchemaType } from '../schema'

type TypographyNodeProps = {
  node: TypographyNodeSchemaType
}

export const TypographyNode: React.FC<TypographyNodeProps> = ({ node }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Determine positioning based on SafeZone
  let justifyContent = 'center'
  if (node.safeZone === 'top-third') justifyContent = 'flex-start'
  if (node.safeZone === 'bottom-third') justifyContent = 'flex-end'

  // Animation logic
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
    opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
      extrapolateRight: 'clamp',
    })
    transform = `translateY(${yOffset}px)`
  } else if (node.animation === 'pop') {
    const scale = interpolate(frame, [0, fps * 0.2], [0.8, 1], {
      extrapolateRight: 'clamp',
    })
    opacity = interpolate(frame, [0, fps * 0.2], [0, 1], {
      extrapolateRight: 'clamp',
    })
    transform = `scale(${scale})`
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent,
        alignItems: 'center',
        padding: '10%', // Padding to ensure text is within fully safe boundaries
      }}
    >
      <div
        style={{
          color: node.color,
          fontSize: `${node.fontSize}px`,
          fontFamily: node.fontFamily || 'Inter, sans-serif',
          fontWeight: 'bold',
          textAlign: 'center',
          opacity,
          transform,
          // Drop shadow to ensure readability on unknown video backgrounds
          textShadow: '0px 4px 20px rgba(0, 0, 0, 0.6)',
        }}
      >
        {node.content}
      </div>
    </div>
  )
}
