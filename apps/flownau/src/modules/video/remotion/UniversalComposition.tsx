import React from 'react'
import { AbsoluteFill, Sequence, Video, Img, useCurrentFrame, interpolate } from 'remotion'
import { VideoTemplate, VideoElement } from '@/types/video-schema'

export const UniversalComposition: React.FC<{ template: VideoTemplate }> = ({ template }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0d0d0d' }}>
      {template.elements.map((element: VideoElement) => (
        <Sequence
          key={element.id}
          from={element.startFrame}
          durationInFrames={element.durationInFrames}
        >
          <RenderElement element={element} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

const RenderElement: React.FC<{ element: VideoElement }> = ({ element }) => {
  const { style, type, content, fadeInDuration, fadeOutDuration, durationInFrames } = element
  const frame = useCurrentFrame()

  const fadeOpacityIn =
    fadeInDuration > 0
      ? interpolate(frame, [0, fadeInDuration], [0, 1], { extrapolateRight: 'clamp' })
      : 1

  const fadeOpacityOut =
    fadeOutDuration > 0
      ? interpolate(frame, [durationInFrames - fadeOutDuration, durationInFrames], [1, 0], {
        extrapolateLeft: 'clamp',
      })
      : 1

  const fadeOpacity = fadeOpacityIn * fadeOpacityOut

  const commonStyle: React.CSSProperties = {
    position: 'absolute',
    left: style.x,
    top: style.y,
    width: style.width ? style.width : undefined,
    height: style.height ? style.height : undefined,
    transform: `rotate(${style.rotation}deg) scale(${style.scale})`,
    opacity: style.opacity * fadeOpacity,
  }

  switch (type) {
    case 'video':
      if (!content) return null
      return (
        <Video
          src={content}
          startFrom={element.mediaStartOffset}
          style={{
            ...commonStyle,
            objectFit: 'cover',
            width: style.width || '100%',
            height: style.height || '100%',
          }}
        />
      )
    case 'image':
      if (!content) return null
      return (
        <Img
          src={content}
          style={{
            ...commonStyle,
            objectFit: 'cover',
            width: style.width || '100%',
            height: style.height || '100%',
          }}
        />
      )
    case 'text':
      return (
        <div
          style={{
            ...commonStyle,
            color: style.color || 'white',
            backgroundColor: style.backgroundColor,
            fontSize: style.fontSize || 40,
            fontFamily: style.fontFamily || 'sans-serif',
            textAlign: style.textAlign as React.CSSProperties['textAlign'],
            whiteSpace: 'pre-wrap',
          }}
        >
          {content}
        </div>
      )
    default:
      return null
  }
}
