import React from 'react'
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion'
import { DynamicCompositionSchemaType } from './schema'
import { ResponsiveMediaNode } from './primitives/ResponsiveMediaNode'
import { ResponsiveTextNode } from './primitives/ResponsiveTextNode'
import { AudioNode } from './primitives/AudioNode'

export type DynamicTemplateMasterProps = {
  schema: DynamicCompositionSchemaType
}

export const DynamicTemplateMaster: React.FC<DynamicTemplateMasterProps> = ({ schema }) => {
  const { width, height } = useVideoConfig()

  // Gracefully handle undefined tracks if schema is malformed visually
  const mediaTracks = schema.tracks?.media || []
  const textTracks = schema.tracks?.text || []
  const audioTracks = schema.tracks?.audio || []

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', width, height, overflow: 'hidden' }}>
      {/* 1. MEDIA TRACK LAYER - Render bottom-most layers first (Video/Images) */}
      {mediaTracks.map((node) => (
        <Sequence
          key={`Media-${node.id}`}
          from={Math.max(0, node.startFrame)}
          durationInFrames={Math.max(1, node.durationInFrames)}
          name={`Media-${node.id}`}
        >
          <ResponsiveMediaNode node={node} />
        </Sequence>
      ))}

      {/* 2. TYPOGRAPHY TRACK LAYER - Render text over the media payloads */}
      {textTracks.map((node) => (
        <Sequence
          key={`Text-${node.id}`}
          from={Math.max(0, node.startFrame)}
          durationInFrames={Math.max(1, node.durationInFrames)}
          name={`Text-${node.id}`}
        >
          <ResponsiveTextNode node={node} />
        </Sequence>
      ))}

      {/* 3. AUDIO TRACK LAYER - Background Audio Logic */}
      {audioTracks.map((node) => (
        <Sequence
          key={`Audio-${node.id}`}
          from={Math.max(0, node.startFrame)}
          durationInFrames={Math.max(1, node.durationInFrames)}
          name={`Audio-${node.id}`}
        >
          <AudioNode node={node} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
