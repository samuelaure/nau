import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SafeText } from '../primitives/SafeText'
import type { BrandStyle } from '@/types/scenes'

export interface CoverSlideProps {
  slots: { title: string; subtitle?: string }
  brandStyle: BrandStyle
}

/**
 * CoverSlide — first slide of a carousel.
 * Bold title with optional subtitle on a brand gradient background.
 * 1080×1350px (portrait carousel format).
 */
export const CoverSlide: React.FC<CoverSlideProps> = ({ slots, brandStyle }) => {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${brandStyle.primaryColor} 0%, ${brandStyle.accentColor} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 60px',
      }}
    >
      <SafeText
        text={slots.title}
        fontSize={64}
        color="#FFFFFF"
        fontFamily={brandStyle.fontFamily}
        safeZone="center-safe"
      />

      {slots.subtitle && (
        <div
          style={{
            marginTop: 32,
            color: '#FFFFFFCC',
            fontSize: 32,
            fontFamily: brandStyle.fontFamily,
            fontWeight: '400',
            textAlign: 'center',
            lineHeight: '1.4',
            maxWidth: '85%',
          }}
        >
          {slots.subtitle}
        </div>
      )}
    </AbsoluteFill>
  )
}
