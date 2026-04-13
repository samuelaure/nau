import React from 'react'
import { AbsoluteFill } from 'remotion'
import type { BrandStyle } from '@/types/scenes'

export interface ListSlideProps {
  slots: { title?: string; items: string[] }
  brandStyle: BrandStyle
}

/**
 * ListSlide — numbered list with accent-colored numbers.
 * Optional title at top, clean spacing between items.
 */
export const ListSlide: React.FC<ListSlideProps> = ({ slots, brandStyle }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F0F0F',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 64px',
      }}
    >
      {slots.title && (
        <div
          style={{
            fontSize: 40,
            fontWeight: '700',
            color: '#FFFFFF',
            fontFamily: brandStyle.fontFamily,
            marginBottom: 40,
            lineHeight: '1.2',
          }}
        >
          {slots.title}
        </div>
      )}

      {slots.items.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            marginBottom: 28,
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: '700',
              color: brandStyle.accentColor,
              fontFamily: brandStyle.fontFamily,
              minWidth: 40,
            }}
          >
            {index + 1}.
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: '400',
              color: '#FFFFFFDD',
              fontFamily: brandStyle.fontFamily,
              lineHeight: '1.45',
              flex: 1,
            }}
          >
            {item}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  )
}
