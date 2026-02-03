'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { VideoTemplate, Asset } from '@/types/video-schema'
import { useEditorStore } from '@/modules/video/store/useEditorStore'
import { usePlaybackStore } from '@/modules/video/store/usePlaybackStore'

// Components
import { EditorSidebar } from './EditorSidebar'
import { LayerList } from './layers/LayerList'
import { AssetBrowser } from './assets/AssetBrowser'
import { EditorCanvas } from './canvas/EditorCanvas'
import { PropertiesPanel } from './properties/PropertiesPanel'
import { Timeline } from './timeline/Timeline'

interface VideoEditorProps {
  templateId: string
  templateName: string
  initialTemplate?: VideoTemplate
  onSave: (template: VideoTemplate) => void
  assets?: Asset[]
  assetsRoot?: string
}

const defaultTemplate: VideoTemplate = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 150,
  elements: [],
}

export default function VideoEditor(props: VideoEditorProps) {
  const { initialTemplate = defaultTemplate, onSave } = props
  const setTemplate = useEditorStore((state) => state.setTemplate)

  // Initialize Store with initial template
  // We use a ref to only do this once on mount
  const initialized = React.useRef(false)
  if (!initialized.current) {
    setTemplate(initialTemplate)
    initialized.current = true
  }

  return <VideoEditorLayout {...props} />
}

function VideoEditorLayout({
  templateId,
  templateName,
  onSave,
  assets = [],
  assetsRoot,
}: VideoEditorProps) {
  const template = useEditorStore((state) => state.template)
  const selectedElementId = useEditorStore((state) => state.selectedElementId)
  const splitElement = useEditorStore((state) => state.splitElement)
  const deleteElement = useEditorStore((state) => state.deleteElement)

  const currentFrame = usePlaybackStore((state) => state.currentFrame)
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  const setIsPlaying = usePlaybackStore((state) => state.setIsPlaying)

  const [sidebarTab, setSidebarTab] = useState<'layers' | 'assets'>('layers')

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying(!isPlaying)
      }

      if (e.key.toLowerCase() === 's') {
        if (selectedElementId) {
          splitElement(selectedElementId, currentFrame)
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        deleteElement(selectedElementId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElementId, currentFrame, splitElement, isPlaying, setIsPlaying, deleteElement])

  return (
    <div className="flex flex-col h-screen bg-background text-text-primary overflow-hidden w-screen">
      {/* Top Bar / Header */}
      <header className="h-[50px] border-b border-border flex items-center px-4 gap-4 bg-panel">
        <Link
          href={`/dashboard/templates/${templateId}`}
          className="text-text-secondary hover:text-text-primary no-underline flex items-center gap-1.5 text-[13px] transition-colors"
        >
          <ChevronLeft size={16} /> Back to Dashboard
        </Link>
        <div className="w-px h-5 bg-border" />
        <div className="text-sm font-semibold">{templateName}</div>
        <div className="flex-1" />
        {/* Save button could go here or in sidebar rail */}
      </header>

      {/* Main Editor Body */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar - Tools (Rail) */}
        <EditorSidebar
          activeTab={sidebarTab}
          setActiveTab={setSidebarTab}
          onSave={() => onSave(template)}
        />

        {/* Side Panel (Layers or Assets) - Contextual Drawer */}
        <aside className="w-[300px] border-r border-border flex flex-col bg-[#161616]">
          {sidebarTab === 'layers' ? (
            <LayerList />
          ) : (
            <AssetBrowser assets={assets} assetsRoot={assetsRoot} />
          )}
        </aside>

        {/* Main Canvas / Player Area */}
        <section className="flex-1 flex flex-col relative overflow-hidden">
          <EditorCanvas />
          <Timeline />
        </section>

        {/* Properties Panel */}
        <aside className="w-[300px] border-l border-border bg-panel">
          <PropertiesPanel />
        </aside>
      </main>
    </div>
  )
}
