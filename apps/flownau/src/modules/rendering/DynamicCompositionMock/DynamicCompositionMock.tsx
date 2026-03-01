import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion'
import { DynamicCompositionSchemaType } from '../DynamicComposition/schema'

export const DynamicCompositionMock: React.FC<{ schema: DynamicCompositionSchemaType }> = ({
  schema,
}) => {
  const { fps, durationInFrames, width, height } = schema
  // Ignore Remotion useVideoConfig for mock static context unless fps/duration mapped

  return (
    <AbsoluteFill style={{ backgroundColor: '#111', color: 'white', overflow: 'hidden' }}>
      {/* RENDER MEDIA */}
      {schema.tracks.media.map((mediaNode, i) => {
        return (
          <Sequence
            key={mediaNode.id}
            from={mediaNode.startFrame}
            durationInFrames={mediaNode.durationInFrames}
            name={`Media-${mediaNode.id}`}
          >
            <AbsoluteFill
              style={{
                backgroundColor: '#3b82f6',
                opacity: 0.5,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                border: '2px dashed blue',
              }}
            >
              <span style={{ fontSize: 40, fontFamily: 'sans-serif' }}>
                MEDIA SLOT: {mediaNode.id}
              </span>
            </AbsoluteFill>
          </Sequence>
        )
      })}

      {/* RENDER TEXT */}
      {schema.tracks.text.map((textNode, i) => {
        // Mock absolute position approximations based on safeZone string
        let top = '50%'
        let transform = 'translateY(-50%)'

        if (textNode.safeZone === 'top-third') {
          top = '15%'
        } else if (textNode.safeZone === 'bottom-third') {
          top = '85%'
        }

        return (
          <Sequence
            key={textNode.id}
            from={textNode.startFrame}
            durationInFrames={textNode.durationInFrames}
            name={`Text-${textNode.id}`}
          >
            <AbsoluteFill
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top,
                  transform,
                  color: textNode.color,
                  fontSize: textNode.fontSize,
                  fontWeight: 'bold',
                  fontFamily: textNode.fontFamily || 'sans-serif',
                  textAlign: 'center',
                  padding: '20px',
                  border: '4px dashed rgba(255, 255, 255, 0.4)',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  width: '80%',
                }}
              >
                {textNode.content}
                <div style={{ fontSize: 20, color: 'gray', marginTop: 10 }}>
                  [{textNode.safeZone}]
                </div>
              </div>
            </AbsoluteFill>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
