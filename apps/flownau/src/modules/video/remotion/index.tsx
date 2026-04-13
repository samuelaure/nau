import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { DynamicTemplateMaster } from '../../rendering/DynamicComposition'
import type { DynamicCompositionSchemaType } from '../../rendering/DynamicComposition/schema'

/**
 * Remotion entry point for flownaŭ.
 *
 * Currently registers DynamicTemplateMaster (the track-based composition system).
 * In Phase 2, SceneSequenceComposition will be added here as the primary composition.
 */
export const RemotionVideo: React.FC = () => {
  return (
    <>
      <Composition
        id="DynamicTemplateMaster"
        component={DynamicTemplateMaster}
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

registerRoot(RemotionVideo)
