
'use client'

import React, { useTransition } from 'react'
import VideoEditor from '@/components/editor/VideoEditor'
import { saveTemplateConfig } from '@/app/dashboard/templates/actions'
import { VideoTemplate } from '@/types/video-schema'

export default function ClientEditor({
    templateId,
    templateName,
    initialConfig,
    assets = [],
}: {
    templateId: string
    templateName: string
    initialConfig: VideoTemplate
    assets?: any[]
}) {
    const [isPending, startTransition] = useTransition()

    const handleSave = (config: VideoTemplate) => {
        startTransition(async () => {
            try {
                await saveTemplateConfig(templateId, config)
                alert('Template saved successfully!')
            } catch (error) {
                console.error(error)
                alert('Failed to save template.')
            }
        })
    }

    return (
        <div style={{ pointerEvents: isPending ? 'none' : 'auto', opacity: isPending ? 0.7 : 1 }}>
            <VideoEditor
                templateId={templateId}
                templateName={templateName}
                initialTemplate={initialConfig}
                onSave={handleSave}
                assets={assets}
            />
        </div>
    )
}
