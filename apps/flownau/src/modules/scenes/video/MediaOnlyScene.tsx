import React from 'react'
import { AbsoluteFill } from 'remotion'
import { MediaBackground } from '../primitives/MediaBackground'
import { BrandWatermark } from '../primitives/BrandWatermark'
import type { BrandStyle, ResolvedScene } from '@/types/scenes'

export interface MediaOnlySceneProps {
  slots: Record<string, never>
  brandStyle: BrandStyle
  asset: ResolvedScene['asset']
  handle?: string
}

/**
 * MediaOnlyScene — full-screen B-roll, no text.
 * Visual breathing room between text-heavy scenes.
 */
export const MediaOnlyScene: React.FC<MediaOnlySceneProps> = ({ asset, handle }) => {
  return (
    <AbsoluteFill>
      {asset ? (
        <MediaBackground assetUrl={asset.url} mediaStartAt={asset.mediaStartAt} type={asset.type} />
      ) : (
        <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }} />
      )}
      {handle && <BrandWatermark handle={handle} position="bottom-right" opacity={0.25} />}
    </AbsoluteFill>
  )
}
