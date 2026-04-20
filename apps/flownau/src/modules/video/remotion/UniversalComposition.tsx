import React from 'react'
import { AbsoluteFill } from 'remotion'
import { VideoTemplate } from '@/types/video-schema'

/**
 * DEPRECATED: V1 Template composition.
 * Left here as a stub so the old dashboard editor doesn't break during V2 transition.
 * Will be fully removed when the legacy editor is sunset.
 */
export const UniversalComposition: React.FC<{ template: VideoTemplate }> = ({
  template: _template,
}) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}
    >
      <div style={{ color: 'white', fontSize: 40 }}>Legacy Template Rendering (Deprecated)</div>
    </AbsoluteFill>
  )
}
