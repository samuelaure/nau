import { AbsoluteFill, Sequence, Video, Img, Audio, interpolate, useCurrentFrame } from 'remotion'
import { DynamicCompositionSchemaType } from '../DynamicComposition/schema'

const TextLayer: React.FC<{ node: any }> = ({ node }) => {
  const frame = useCurrentFrame()

  // Animation logic
  let opacity = 1
  let scale = 1
  let translateY = 0

  if (node.animation === 'fade') {
    opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
  } else if (node.animation === 'pop') {
    scale = interpolate(frame, [0, 10, 15], [0, 1.2, 1], { extrapolateRight: 'clamp' })
  } else if (node.animation === 'slide-up') {
    translateY = interpolate(frame, [0, 15], [50, 0], { extrapolateRight: 'clamp' })
  }

  // Positioning
  let top = '50%'
  if (node.safeZone === 'top-third') top = '20%'
  if (node.safeZone === 'bottom-third') top = '80%'

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: '50%',
        transform: `translate(-50%, -50%) scale(${scale}) translateY(${translateY}px)`,
        opacity,
        color: node.color || '#FFFFFF',
        fontSize: node.fontSize || 60,
        fontWeight: '900',
        fontFamily: 'Inter, sans-serif',
        textAlign: 'center',
        width: '80%',
        textShadow: '0 4px 20px rgba(0,0,0,0.8)',
        // Removed background, padding and border for "simple text" look
      }}
    >
      {node.content}
    </div>
  )
}

export const DynamicCompositionMock: React.FC<{ schema: DynamicCompositionSchemaType }> = ({
  schema,
}) => {
  if (!schema?.tracks) return null

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {/* RENDER MEDIA */}
      {schema.tracks.media.map((mediaNode) => {
        const isImage = mediaNode.assetUrl.match(/\.(jpg|jpeg|png|webp)$/i)

        return (
          <Sequence
            key={mediaNode.id}
            from={mediaNode.startFrame}
            durationInFrames={mediaNode.durationInFrames}
          >
            <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {isImage ? (
                <Img
                  src={mediaNode.assetUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: mediaNode.scale === 'cover' ? 'cover' : 'contain'
                  }}
                />
              ) : (
                <Video
                  src={mediaNode.assetUrl}
                  startFrom={mediaNode.mediaStartAt || 0}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: mediaNode.scale === 'cover' ? 'cover' : 'contain'
                  }}
                />
              )}
            </AbsoluteFill>
          </Sequence>
        )
      })}

      {/* RENDER OVERLAY (Between Background and Text) */}
      {schema.tracks.overlay?.map((overlayNode) => (
        <Sequence
          key={overlayNode.id}
          from={overlayNode.startFrame}
          durationInFrames={overlayNode.durationInFrames}
        >
          <AbsoluteFill
            style={{
              backgroundColor: overlayNode.color,
              opacity: overlayNode.opacity
            }}
          />
        </Sequence>
      ))}

      {/* RENDER AUDIO */}
      {schema.tracks.audio?.map((audioNode) => (
        <Sequence
          key={audioNode.id}
          from={audioNode.startFrame}
          durationInFrames={audioNode.durationInFrames}
        >
          <Audio src={audioNode.assetUrl} volume={audioNode.volume ?? 1} />
        </Sequence>
      ))}

      {/* RENDER TEXT */}
      {schema.tracks.text.map((textNode) => (
        <Sequence
          key={textNode.id}
          from={textNode.startFrame}
          durationInFrames={textNode.durationInFrames}
        >
          <TextLayer node={textNode} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
