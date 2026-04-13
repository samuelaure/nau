import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { SafeText } from '../primitives/SafeText'
import { MediaBackground } from '../primitives/MediaBackground'
import { DarkOverlay } from '../primitives/DarkOverlay'
import type { BrandStyle, ResolvedScene } from '@/types/scenes'

export interface QuoteCardSceneProps {
  slots: { quote: string; attribution?: string }
  brandStyle: BrandStyle
  asset: ResolvedScene['asset']
}

/**
 * QuoteCardScene — centered quote with decorative border lines.
 * Optional attribution below, optional dimmed B-roll background.
 */
export const QuoteCardScene: React.FC<QuoteCardSceneProps> = ({ slots, brandStyle, asset }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const borderWidth = interpolate(frame, [0, fps * 0.5], [0, 60], {
    extrapolateRight: 'clamp',
  })

  const textOpacity = interpolate(frame, [fps * 0.2, fps * 0.6], [0, 1], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill>
      {asset ? (
        <>
          <MediaBackground
            assetUrl={asset.url}
            mediaStartAt={asset.mediaStartAt}
            type={asset.type}
          />
          <DarkOverlay opacity={0.6} />
        </>
      ) : (
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg, ${brandStyle.primaryColor}22 0%, ${brandStyle.accentColor}22 100%)`,
            backgroundColor: '#0a0a0a',
          }}
        />
      )}

      {/* Decorative top border */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: `${borderWidth}%`,
          height: 3,
          backgroundColor: brandStyle.accentColor,
          transition: 'width 0.3s',
        }}
      />

      {/* Quote text */}
      <div style={{ opacity: textOpacity }}>
        <SafeText
          text={`"${slots.quote}"`}
          fontSize={52}
          color="#FFFFFF"
          fontFamily={brandStyle.fontFamily}
          fontWeight="700"
          safeZone="center-safe"
          animation="none"
        />
      </div>

      {/* Attribution */}
      {slots.attribution && (
        <div
          style={{
            position: 'absolute',
            bottom: '35%',
            width: '100%',
            textAlign: 'center',
            opacity: textOpacity,
            color: '#FFFFFF99',
            fontSize: 24,
            fontFamily: brandStyle.fontFamily,
            fontWeight: '500',
          }}
        >
          — {slots.attribution}
        </div>
      )}

      {/* Decorative bottom border */}
      <div
        style={{
          position: 'absolute',
          bottom: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: `${borderWidth}%`,
          height: 3,
          backgroundColor: brandStyle.accentColor,
        }}
      />
    </AbsoluteFill>
  )
}
