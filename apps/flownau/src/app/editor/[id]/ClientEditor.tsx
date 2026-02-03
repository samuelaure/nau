'use client'

import React, { useTransition } from 'react'
import { toast } from 'sonner'
import VideoEditor from '@/modules/video/components/editor/VideoEditor'
import { saveTemplateConfig } from '@/modules/video/actions'
import { VideoTemplate, Asset } from '@/types/video-schema'

export default function ClientEditor({
  templateId,
  templateName,
  initialConfig,
  assets = [],
  assetsRoot,
}: {
  templateId: string
  templateName: string
  initialConfig: VideoTemplate
  assets?: Asset[]
  assetsRoot?: string
}) {
  const [isPending, startTransition] = useTransition()

  const handleSave = (config: VideoTemplate) => {
    startTransition(async () => {
      try {
        await saveTemplateConfig(templateId, config)
        toast.success('Project saved successfully')
      } catch (error) {
        console.error(error)
        toast.error('Failed to save project')
      }
    })
  }

  return (
    <div
      className={`w-full h-full transition-all duration-500 ${isPending ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}
    >
      <VideoEditor
        templateId={templateId}
        templateName={templateName}
        initialTemplate={initialConfig}
        onSave={handleSave}
        assets={assets}
        assetsRoot={assetsRoot}
      />
    </div>
  )
}
