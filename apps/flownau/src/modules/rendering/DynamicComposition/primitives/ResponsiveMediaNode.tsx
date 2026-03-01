import React from 'react'
import { Video, Img, OffthreadVideo } from 'remotion'
import { MediaNodeSchemaType } from '../schema'

export type ResponsiveMediaNodeProps = {
  node: MediaNodeSchemaType
}

export const ResponsiveMediaNode: React.FC<ResponsiveMediaNodeProps> = ({ node }) => {
  if (!node.assetUrl || node.assetUrl === 'placeholder') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#1E1E2E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff55',
          fontFamily: 'sans-serif',
          fontSize: 30,
        }}
      >
        Missing Asset: {node.id}
      </div>
    )
  }

  const cleanUrl = node.assetUrl.toLowerCase()
  const isVideo =
    cleanUrl.includes('.mp4') ||
    cleanUrl.includes('.mov') ||
    cleanUrl.includes('.webm') ||
    cleanUrl.includes('/video/') // Catching some dynamic signed urls that might not have extension

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: node.scale === 'contain' ? 'contain' : 'cover', // cover fills, contain fits
  }

  if (isVideo) {
    // We use OffthreadVideo for remote URLs for better performance and timeline stability
    // However, if it's a local proxy endpoint or standard static URL, standard Video also works.
    // OffthreadVideo ensures frames don't drop on heavy remote mp4s.
    return (
      <OffthreadVideo
        src={node.assetUrl}
        style={style}
        startFrom={node.mediaStartAt || 0}
        volume={0}
      />
    )
  }

  // Render Image
  return <Img src={node.assetUrl} style={style} />
}
