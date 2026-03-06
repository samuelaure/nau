import React from 'react'
import { AbsoluteFill } from 'remotion'
import { OverlayNodeSchema } from '../schema'
import { z } from 'zod'

export type OverlayNodeProps = {
    node: z.infer<typeof OverlayNodeSchema>
}

export const OverlayNode: React.FC<OverlayNodeProps> = ({ node }) => {
    return (
        <AbsoluteFill
            style={{
                backgroundColor: node.color,
                opacity: node.opacity,
            }}
        />
    )
}
