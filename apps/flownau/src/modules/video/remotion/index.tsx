import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { InstagramPost } from './templates/InstagramPost'
import { UniversalComposition } from './UniversalComposition'
import { DynamicComposition } from '../../rendering/DynamicComposition'
import type { DynamicCompositionSchemaType } from '../../rendering/DynamicComposition/schema'

export const RemotionVideo: React.FC = () => {
  return (
    <>
      <Composition
        id="InstagramPost"
        component={InstagramPost}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: 'Sample Title',
          subtitle: 'Sample Subtitle',
        }}
      />
      <Composition
        id="Universal"
        component={UniversalComposition}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          template: {
            width: 1080,
            height: 1920,
            fps: 30,
            durationInFrames: 150,
            elements: [],
          },
        }}
      />
      <Composition
        id="DynamicComposition"
        component={DynamicComposition}
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
