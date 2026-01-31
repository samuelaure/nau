import React from 'react'
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion'

export interface InstagramPostProps {
  title: string
  subtitle?: string
  image?: string
  primaryColor?: string
}

export const InstagramPost: React.FC<Partial<InstagramPostProps>> = ({
  title = 'Hello World',
  subtitle = 'generated with flownaŭ',
  image,
  primaryColor = '#7C3AED',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  })

  const titleScale = spring({
    frame,
    fps,
    config: {
      damping: 12,
    },
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          transform: `scale(${titleScale})`,
          opacity: titleOpacity,
        }}
      >
        <h1 style={{ fontSize: 80, color: primaryColor, marginBottom: 20 }}>{title}</h1>
        <p style={{ fontSize: 40, opacity: 0.8 }}>{subtitle}</p>
      </div>
    </AbsoluteFill>
  )
}
