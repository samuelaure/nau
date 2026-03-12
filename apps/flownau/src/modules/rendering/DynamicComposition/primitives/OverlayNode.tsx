import React from 'react'
import { AbsoluteFill } from 'remotion'
import { OverlayNodeSchema } from '../schema'
import { z } from 'zod'

export type OverlayNodeProps = {
  node: z.infer<typeof OverlayNodeSchema>
}

export const OverlayNode: React.FC<OverlayNodeProps> = ({ node }) => {
  const hex = node.color || '#000000'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${node.opacity})`,
      }}
    />
  )
}
