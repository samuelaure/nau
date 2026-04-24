import React from 'react'
import { AbsoluteFill } from 'remotion'
import type { BrandStyle } from '@/types/scenes'

export interface CTASlideProps {
  slots: { cta: string; handle?: string }
  brandStyle: BrandStyle
}

/**
 * CTASlide — final carousel slide with call-to-action.
 * Brand gradient background, centered CTA text, optional handle.
 */
export const CTASlide: React.FC<CTASlideProps> = ({ slots, brandStyle }) => {
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
      <div
        style={{
          fontSize: 48,
          fontWeight: '700',
          color: '#FFFFFF',
          fontFamily: brandStyle.fontFamily,
          textAlign: 'center',
          lineHeight: '1.3',
          maxWidth: '85%',
        }}
      >
        {slots.cta}
      </div>

      {slots.handle && (
        <div
          style={{
            marginTop: 36,
            fontSize: 28,
            fontWeight: '600',
            color: '#FFFFFFCC',
            fontFamily: brandStyle.fontFamily,
            textAlign: 'center',
          }}
        >
          {slots.handle}
        </div>
      )}
    </AbsoluteFill>
  )
}
