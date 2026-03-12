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
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: top === '20%' ? 'flex-start' : top === '80%' ? 'flex-end' : 'center',
        justifyContent: 'center',
        paddingTop: top === '20%' ? '18%' : undefined,
        paddingBottom: top === '80%' ? '35%' : undefined,
        opacity,
        isolation: 'isolate',
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          color: node.color || '#FFFFFF',
          fontSize: node.fontSize || 60,
          fontWeight: '900',
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          width: '80%',
          // Tight shadow - avoids large dark bloom bleeding across the overlay
          textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.7)',
          whiteSpace: 'pre-line',
        }}
      >
        {node.content}
      </div>
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
            <AbsoluteFill
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              {isImage ? (
                <Img
                  src={mediaNode.assetUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: mediaNode.scale === 'cover' ? 'cover' : 'contain',
                  }}
                />
              ) : (
                <Video
                  src={mediaNode.assetUrl}
                  startFrom={mediaNode.mediaStartAt || 0}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: mediaNode.scale === 'cover' ? 'cover' : 'contain',
                  }}
                />
              )}
            </AbsoluteFill>
          </Sequence>
        )
      })}

      {/* RENDER OVERLAY (Between Background and Text) */}
      {schema.tracks.overlay?.map((overlayNode) => {
        const hex = overlayNode.color || '#000000'
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return (
          <Sequence
            key={overlayNode.id}
            from={overlayNode.startFrame}
            durationInFrames={overlayNode.durationInFrames}
          >
            <AbsoluteFill
              style={{
                backgroundColor: `rgba(${r}, ${g}, ${b}, ${overlayNode.opacity})`,
              }}
            />
          </Sequence>
        )
      })}

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
