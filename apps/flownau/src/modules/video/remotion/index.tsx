import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { ReelT1, ReelT2, ReelT3, ReelT4, type ReelSlotProps } from './ReelTemplates'
import { DynamicReelComposition, calcDynamicReelFrames, type DynamicReelProps } from './DynamicReelComposition'

const defaultReelProps: ReelSlotProps = {
  slots: {},
  caption: '',
  hashtags: [],
  brollClips: [],
  brand: {},
}

const defaultDynamicReelProps: DynamicReelProps = {
  scenes: [],
  audioUrl: undefined,
  brand: {},
}

export const RemotionVideo: React.FC = () => {
  return (
    <>
      {/* ── Dynamic reel (block-based templates) ──────────────────────────── */}
      <Composition
        id="DynamicReel"
        component={DynamicReelComposition as any}
        durationInFrames={90} // default — overridden by calculateMetadata
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultDynamicReelProps}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: calcDynamicReelFrames(
            ((props as unknown as DynamicReelProps).scenes) ?? [],
          ),
        })}
      />

      {/* ── Legacy slot-based reel templates (Astromatic style) ───────────── */}
      {/* Kept for backwards compatibility — existing rendered posts still reference these */}
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
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps}
      />
      <Composition
        id="ReelT3"
        component={ReelT3 as any}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps}
      />
      <Composition
        id="ReelT4"
        component={ReelT4 as any}
        durationInFrames={360}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps}
      />
    </>
  )
}

registerRoot(RemotionVideo as any)
