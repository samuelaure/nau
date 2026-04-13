import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SafeText } from '../primitives/SafeText'
import { MediaBackground } from '../primitives/MediaBackground'
import { DarkOverlay } from '../primitives/DarkOverlay'
import type { BrandStyle, ResolvedScene } from '@/types/scenes'

export interface CTACardSceneProps {
  slots: { cta: string; handle?: string }
  brandStyle: BrandStyle
  asset: ResolvedScene['asset']
}

/**
 * CTACardScene — call-to-action card, typically the last scene.
 * Brand gradient or dimmed B-roll background.
 */
export const CTACardScene: React.FC<CTACardSceneProps> = ({ slots, brandStyle, asset }) => {
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
            background: `linear-gradient(135deg, ${brandStyle.primaryColor} 0%, ${brandStyle.accentColor} 100%)`,
          }}
        />
      )}

      <SafeText
        text={slots.cta}
        fontSize={56}
        color="#FFFFFF"
        fontFamily={brandStyle.fontFamily}
        safeZone="center-safe"
        animation="slide-up"
      />

      {slots.handle && (
        <div
          style={{
            position: 'absolute',
            bottom: '38%',
            width: '100%',
            textAlign: 'center',
            color: '#FFFFFFCC',
            fontSize: 28,
            fontFamily: brandStyle.fontFamily,
            fontWeight: '600',
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          }}
        >
          {slots.handle}
        </div>
      )}
    </AbsoluteFill>
  )
}
