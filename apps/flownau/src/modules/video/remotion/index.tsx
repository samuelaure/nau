import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { InstagramPost } from './templates/InstagramPost'
import { UniversalComposition } from './UniversalComposition'

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
    </>
  )
}

registerRoot(RemotionVideo)
