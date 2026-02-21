import React from 'react'
import { Video, Img } from 'remotion'
import { MediaNodeSchemaType } from '../schema'

type MediaNodeProps = {
  node: MediaNodeSchemaType
}

export const MediaNode: React.FC<MediaNodeProps> = ({ node }) => {
  const isVideo =
    node.assetUrl.endsWith('.mp4') ||
    node.assetUrl.endsWith('.mov') ||
    node.assetUrl.endsWith('.webm')

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: node.scale === 'contain' ? 'contain' : 'cover',
  }

  if (isVideo) {
    return <Video src={node.assetUrl} style={style} startFrom={node.mediaStartAt} />
  }

  return <Img src={node.assetUrl} style={style} />
}
