import React from 'react'
import { Audio } from 'remotion'
import { AudioNodeSchemaType } from '../schema'

export const AudioNode: React.FC<{ node: AudioNodeSchemaType }> = ({ node }) => {
  return (
    <Audio
      src={node.assetUrl}
      volume={node.volume ?? 1}
      startFrom={0} // Typically audio starts from 0 unless AI specifies offset
    />
  )
}
