import React from 'react'
import { Audio } from 'remotion'
import { AudioNodeSchemaType } from '../schema'

export const AudioNode: React.FC<{ node: AudioNodeSchemaType }> = ({ node }) => {
  return <Audio src={node.assetUrl} volume={node.volume ?? 1} startFrom={node.mediaStartAt ?? 0} />
}
