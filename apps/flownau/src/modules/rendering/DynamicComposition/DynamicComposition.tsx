import React from 'react'
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion'
import { DynamicCompositionSchemaType } from './schema'
import { MediaNode } from './primitives/MediaNode'
import { TypographyNode } from './primitives/TypographyNode'
import { AudioNode } from './primitives/AudioNode'

export type DynamicCompositionProps = {
  schema: DynamicCompositionSchemaType
}

export const DynamicComposition: React.FC<DynamicCompositionProps> = ({ schema }) => {
  const { width, height } = useVideoConfig()

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', width, height }}>
      {/* 1. Media Track Layer */}
      {schema.tracks.media.map((node) => (
        <Sequence
          key={node.id}
          from={Math.max(0, node.startFrame)}
          durationInFrames={Math.max(1, node.durationInFrames)}
        >
          <MediaNode node={node} />
        </Sequence>
      ))}

      {/* 2. Typography Track Layer */}
      {schema.tracks.text.map((node) => (
        <Sequence
          key={node.id}
          from={Math.max(0, node.startFrame)}
          durationInFrames={Math.max(1, node.durationInFrames)}
        >
          <TypographyNode node={node} />
        </Sequence>
      ))}

      {/* 3. Audio Track Layer */}
      {schema.tracks.audio.map((node) => (
        <Sequence
          key={node.id}
          from={Math.max(0, node.startFrame)}
          durationInFrames={Math.max(1, node.durationInFrames)}
        >
          <AudioNode node={node} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
