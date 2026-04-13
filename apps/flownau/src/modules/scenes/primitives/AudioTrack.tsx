import React from 'react'
import { Audio } from 'remotion'

export interface AudioTrackProps {
  assetUrl: string
  volume?: number
  startFrom?: number
}

/**
 * AudioTrack — renders an audio element for the composition.
 * Uses the corrected startFrom prop (not hardcoded to 0).
 */
export const AudioTrack: React.FC<AudioTrackProps> = ({ assetUrl, volume = 1, startFrom = 0 }) => {
  return <Audio src={assetUrl} volume={volume} startFrom={startFrom} />
}
