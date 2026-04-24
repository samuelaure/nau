import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { DynamicTemplateMaster } from '../../rendering/DynamicComposition'
import type { DynamicCompositionSchemaType } from '../../rendering/DynamicComposition/schema'
import { SceneSequenceComposition } from '../../scenes/SceneSequenceComposition'

/**
 * Remotion entry point for flownaŭ.
 *
 * Compositions:
 * - SceneSequence: v2 scene-based composition (PRIMARY)
 * - DynamicTemplateMaster: v1 track-based composition (DEPRECATED — backward compat)
 */
export const RemotionVideo: React.FC = () => {
  return (
    <>
      {/* v2: Scene-based composition — the new primary */}
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
          return {
            durationInFrames: totalFrames,
            fps: 30,
            width: 1080,
            height: 1920,
          }
        }}
        defaultProps={
          {
            scenes: [],
            audio: null,
            brandStyle: {
              primaryColor: '#6C63FF',
              accentColor: '#FF6584',
              fontFamily: 'sans-serif',
            },
            handle: undefined,
          } as any
        }
      />

      {/* v1: Legacy track-based composition (backward compat) */}
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
            tracks: {
              overlay: [],
              media: [
                {
                  id: 'media-1',
                  type: 'media',
                  assetUrl:
                    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                  startFrame: 0,
                  durationInFrames: 150,
                  mediaStartAt: 0,
                  scale: 'cover',
                },
              ],
              text: [
                {
                  id: 'text-1',
                  type: 'text',
                  content: 'Dynamic Title!',
                  startFrame: 0,
                  durationInFrames: 150,
                  safeZone: 'center-safe',
                  color: '#FF0000',
                  fontSize: 100,
                  animation: 'pop',
                },
              ],
              audio: [],
            },
          },
        }}
      />
    </>
  )
}

registerRoot(RemotionVideo as any)
