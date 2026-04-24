import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'
import { getSceneComponent } from './scene-registry'
import { AudioTrack } from './primitives/AudioTrack'
import { BrandWatermark } from './primitives/BrandWatermark'
import type { ResolvedScene, AudioConfig, BrandStyle } from '@/types/scenes'

export interface SceneSequenceCompositionProps {
  scenes: ResolvedScene[]
  audio?: AudioConfig | null
  brandStyle: BrandStyle
  handle?: string
}

/**
 * SceneSequenceComposition — the master Remotion composition.
 * Renders a sequence of scene components with correct timing via <Sequence>.
 * Adds audio track and brand watermark if configured.
 */
export const SceneSequenceComposition: React.FC<SceneSequenceCompositionProps> = ({
  scenes,
  audio,
  brandStyle,
  handle,
}) => {
  return (
    <AbsoluteFill>
      {/* Render each scene in sequence */}
      {scenes.map((scene, index) => {
        const SceneComponent = getSceneComponent(scene.type)

        return (
          <Sequence
            key={`scene-${index}`}
            from={scene.startFrame}
            durationInFrames={scene.durationInFrames}
          >
            <SceneComponent
              slots={scene.slots}
              brandStyle={brandStyle}
              asset={scene.asset}
              handle={handle}
            />
          </Sequence>
        )
      })}

      {/* Audio track spans the entire composition */}
      {audio && (
        <Sequence from={0} durationInFrames={audio.durationInFrames}>
          <AudioTrack assetUrl={audio.url} volume={audio.volume} startFrom={audio.startFrom} />
        </Sequence>
      )}

      {/* Persistent brand watermark */}
      {handle && <BrandWatermark handle={handle} position="bottom-right" opacity={0.25} />}
    </AbsoluteFill>
  )
}
