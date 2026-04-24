import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SafeText } from '../primitives/SafeText'
import { MediaBackground } from '../primitives/MediaBackground'
import { DarkOverlay } from '../primitives/DarkOverlay'
import type { BrandStyle, ResolvedScene } from '@/types/scenes'

export interface TextOverMediaSceneProps {
  slots: { text: string }
  brandStyle: BrandStyle
  asset: ResolvedScene['asset']
}

/**
 * TextOverMediaScene — the PRIMARY/WORKHORSE scene for Reels.
 * Text overlaid on B-roll video with dark overlay for readability.
 */
export const TextOverMediaScene: React.FC<TextOverMediaSceneProps> = ({
  slots,
  brandStyle,
  asset,
}) => {
  return (
    <AbsoluteFill>
      {asset && (
        <MediaBackground assetUrl={asset.url} mediaStartAt={asset.mediaStartAt} type={asset.type} />
      )}
      <DarkOverlay opacity={0.45} />
      <SafeText
        text={slots.text}
        fontSize={64}
        color="#FFFFFF"
        fontFamily={brandStyle.fontFamily}
        safeZone="center-safe"
        animation="fade"
      />
    </AbsoluteFill>
  )
}
