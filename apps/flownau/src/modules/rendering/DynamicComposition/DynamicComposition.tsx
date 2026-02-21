import React from 'react'
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion'
import { DynamicCompositionSchemaType } from './schema'
import { MediaNode } from './primitives/MediaNode'
import { TypographyNode } from './primitives/TypographyNode'

export type DynamicCompositionProps = {
  schema: DynamicCompositionSchemaType
}

export const DynamicComposition: React.FC<DynamicCompositionProps> = ({ schema }) => {
  const { width, height } = useVideoConfig()

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', width, height }}>
      {schema.scenes.map((scene) => {
        return (
          <Sequence
            key={scene.id}
            from={scene.startFrame}
            durationInFrames={scene.durationInFrames}
          >
            {/* Split layout mapping logic */}
            {scene.layout === 'split-horizontal' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
              >
                {scene.nodes.map((node, i) => (
                  <div key={node.id} style={{ flex: 1, position: 'relative' }}>
                    {node.type === 'media' && <MediaNode node={node} />}
                    {node.type === 'text' && <TypographyNode node={node} />}
                  </div>
                ))}
              </div>
            )}

            {/* Split vertical mapping logic */}
            {scene.layout === 'split-vertical' && (
              <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%' }}>
                {scene.nodes.map((node, i) => (
                  <div key={node.id} style={{ flex: 1, position: 'relative' }}>
                    {node.type === 'media' && <MediaNode node={node} />}
                    {node.type === 'text' && <TypographyNode node={node} />}
                  </div>
                ))}
              </div>
            )}

            {/* Full layout mapping logic */}
            {scene.layout === 'full' && (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {scene.nodes.map((node) => (
                  <div
                    key={node.id}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  >
                    {node.type === 'media' && <MediaNode node={node} />}
                    {node.type === 'text' && <TypographyNode node={node} />}
                  </div>
                ))}
              </div>
            )}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
