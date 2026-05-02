import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { ReelT1, ReelT2, ReelT3, ReelT4, type ReelSlotProps } from './ReelTemplates'

const defaultReelProps: ReelSlotProps = {
  slots: {},
  caption: '',
  hashtags: [],
  brollClips: [],
  brand: {},
}

export const RemotionVideo: React.FC = () => {
  return (
    <>
      {/* ── Slot-based reel templates (Astromatic style) ─────────────────── */}
      <Composition
        id="ReelT1"
        component={ReelT1 as any}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps}
      />
      <Composition
        id="ReelT2"
        component={ReelT2 as any}
        durationInFrames={195}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps}
      />
      <Composition
        id="ReelT3"
        component={ReelT3 as any}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps}
      />
      <Composition
        id="ReelT4"
        component={ReelT4 as any}
        durationInFrames={330}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps}
      />

    </>
  )
}

registerRoot(RemotionVideo as any)
