import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { DynamicTemplateMaster } from '../../rendering/DynamicComposition'
import type { DynamicCompositionSchemaType } from '../../rendering/DynamicComposition/schema'
import { SceneSequenceComposition } from '../../scenes/SceneSequenceComposition'
import { ReelT1, ReelT2, ReelT3, ReelT4, type ReelSlotProps } from './ReelTemplates'

const defaultReelProps: ReelSlotProps = {
  slots: {},
  caption: '',
  hashtags: [],
  brollUrls: [],
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

      {/* ── Legacy: Scene-based composition ─────────────────────────────── */}
      <Composition
        id="SceneSequence"
        component={SceneSequenceComposition as any}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }: { props: any }) => {
          if (!props.scenes || props.scenes.length === 0) {
            return { durationInFrames: 450, fps: 30, width: 1080, height: 1920 }
          }
          const lastScene = props.scenes[props.scenes.length - 1]
          const totalFrames = lastScene.startFrame + lastScene.durationInFrames
          return { durationInFrames: totalFrames, fps: 30, width: 1080, height: 1920 }
        }}
        defaultProps={
          {
            scenes: [],
            audio: null,
            brandStyle: { primaryColor: '#6C63FF', accentColor: '#FF6584', fontFamily: 'sans-serif' },
            handle: undefined,
          } as any
        }
      />

      {/* ── Legacy: Track-based composition (deprecated) ─────────────────── */}
      <Composition
        id="DynamicTemplateMaster"
        component={DynamicTemplateMaster as any}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }) => {
          const schema = props.schema as DynamicCompositionSchemaType
          return {
            durationInFrames: schema?.durationInFrames || 150,
            fps: schema?.fps || 30,
            width: schema?.width || 1080,
            height: schema?.height || 1920,
          }
        }}
        defaultProps={{
          schema: {
            format: 'reel',
            fps: 30,
            durationInFrames: 150,
            width: 1080,
            height: 1920,
            tracks: { overlay: [], media: [], text: [], audio: [] },
          },
        }}
      />
    </>
  )
}

registerRoot(RemotionVideo as any)
