import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { MediaBackground } from '../primitives/MediaBackground'
import { DarkOverlay } from '../primitives/DarkOverlay'
import type { BrandStyle, ResolvedScene } from '@/types/scenes'

export interface ListRevealSceneProps {
  slots: { title?: string; items: string[] }
  brandStyle: BrandStyle
  asset: ResolvedScene['asset']
}

/**
 * ListRevealScene — items appear one by one with staggered animation.
 * Each item gets equal screen time within the scene duration.
 */
export const ListRevealScene: React.FC<ListRevealSceneProps> = ({ slots, brandStyle, asset }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const itemCount = slots.items.length
  // Each item gets an equal time slice, with a small delay for the title
  const titleFrames = slots.title ? fps * 0.5 : 0
  const availableFrames = durationInFrames - titleFrames
  const framesPerItem = Math.max(1, Math.floor(availableFrames / itemCount))

  const titleOpacity = slots.title
    ? interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: 'clamp' })
    : 0

  return (
    <AbsoluteFill>
      {asset ? (
        <>
          <MediaBackground
            assetUrl={asset.url}
            mediaStartAt={asset.mediaStartAt}
            type={asset.type}
          />
          <DarkOverlay opacity={0.55} />
        </>
      ) : (
        <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }} />
      )}

      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '15% 8%',
          gap: 16,
        }}
      >
        {/* Title */}
        {slots.title && (
          <div
            style={{
              opacity: titleOpacity,
              color: brandStyle.accentColor,
              fontSize: 36,
              fontFamily: brandStyle.fontFamily,
              fontWeight: '800',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 20,
              textShadow: '0 2px 6px rgba(0,0,0,0.8)',
            }}
          >
            {slots.title}
          </div>
        )}

        {/* Items */}
        {slots.items.map((item, index) => {
          const itemStart = titleFrames + index * framesPerItem
          const itemOpacity = interpolate(frame, [itemStart, itemStart + fps * 0.3], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
          const itemY = interpolate(frame, [itemStart, itemStart + fps * 0.3], [20, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })

          return (
            <div
              key={index}
              style={{
                opacity: itemOpacity,
                transform: `translateY(${itemY}px)`,
                color: '#FFFFFF',
                fontSize: 40,
                fontFamily: brandStyle.fontFamily,
                fontWeight: '700',
                textAlign: 'center',
                maxWidth: '85%',
                textShadow: '0 2px 6px rgba(0,0,0,0.8)',
                lineHeight: 1.3,
              }}
            >
              {item}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
