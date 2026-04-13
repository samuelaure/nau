import React from 'react'
import { AbsoluteFill } from 'remotion'
import type { BrandStyle } from '@/types/scenes'

export interface ContentSlideProps {
  slots: { heading: string; body: string }
  brandStyle: BrandStyle
}

/**
 * ContentSlide — heading + body text for carousel educational content.
 * Clean layout with accent separator line.
 */
export const ContentSlide: React.FC<ContentSlideProps> = ({ slots, brandStyle }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F0F0F',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 72px',
      }}
    >
      <div
        style={{
          fontSize: 44,
          fontWeight: '700',
          color: '#FFFFFF',
          fontFamily: brandStyle.fontFamily,
          lineHeight: '1.25',
          marginBottom: 24,
        }}
      >
        {slots.heading}
      </div>

      {/* Accent separator */}
      <div
        style={{
          width: 60,
          height: 4,
          borderRadius: 2,
          backgroundColor: brandStyle.accentColor,
          marginBottom: 28,
        }}
      />

      <div
        style={{
          fontSize: 28,
          fontWeight: '400',
          color: '#FFFFFFCC',
          fontFamily: brandStyle.fontFamily,
          lineHeight: '1.55',
        }}
      >
        {slots.body}
      </div>
    </AbsoluteFill>
  )
}
