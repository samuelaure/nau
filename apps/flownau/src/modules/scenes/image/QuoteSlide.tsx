import React from 'react'
import { AbsoluteFill } from 'remotion'
import type { BrandStyle } from '@/types/scenes'

export interface QuoteSlideProps {
  slots: { quote: string; attribution?: string }
  brandStyle: BrandStyle
}

/**
 * QuoteSlide — stylized quote with decorative quotation marks.
 * Centered layout with optional attribution at bottom.
 */
export const QuoteSlide: React.FC<QuoteSlideProps> = ({ slots, brandStyle }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F0F0F',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '100px 64px',
      }}
    >
      {/* Decorative opening quote mark */}
      <div
        style={{
          fontSize: 120,
          color: brandStyle.accentColor,
          fontFamily: 'Georgia, serif',
          lineHeight: '0.8',
          marginBottom: 16,
          opacity: 0.6,
        }}
      >
        &ldquo;
      </div>

      <div
        style={{
          fontSize: 36,
          fontWeight: '500',
          color: '#FFFFFF',
          fontFamily: brandStyle.fontFamily,
          textAlign: 'center',
          lineHeight: '1.5',
          maxWidth: '90%',
        }}
      >
        {slots.quote}
      </div>

      {slots.attribution && (
        <div
          style={{
            marginTop: 40,
            fontSize: 22,
            fontWeight: '400',
            color: brandStyle.accentColor,
            fontFamily: brandStyle.fontFamily,
            textAlign: 'center',
          }}
        >
          — {slots.attribution}
        </div>
      )}
    </AbsoluteFill>
  )
}
