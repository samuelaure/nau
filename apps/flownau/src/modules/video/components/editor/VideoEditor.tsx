'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { VideoTemplate, Asset } from '@/types/video-schema'
import { useEditorStore } from '@/modules/video/store/useEditorStore'
import { usePlaybackStore } from '@/modules/video/store/usePlaybackStore'
import { useHistoryStore } from '@/modules/video/store/useHistoryStore'

// Components
import { EditorSidebar } from './EditorSidebar'
import { LayerList } from './layers/LayerList'
import { AssetBrowser } from './assets/AssetBrowser'
import { EditorCanvas } from './canvas/EditorCanvas'
import { PropertiesPanel } from './properties/PropertiesPanel'
import { Timeline } from './timeline/Timeline'
import { ShortcutsModal } from './ShortcutsModal'
// Error Boundaries
import {
  EditorErrorBoundary,
  CanvasErrorBoundary,
  TimelineErrorBoundary,
  AssetErrorBoundary,
} from '../boundaries'
import { saveToLocalStorage, loadFromLocalStorage, clearAutosave } from '../../utils/autosave'
import { toast } from 'sonner'

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
  const { initialTemplate = defaultTemplate } = props
  const setTemplate = useEditorStore((state) => state.setTemplate)

  // Initialize Store with initial template (React 19 compliant)
  useEffect(() => {
    const autosave = loadFromLocalStorage(props.templateId)

    if (autosave && autosave.template) {
      toast('Found unsaved changes from ' + new Date(autosave.timestamp).toLocaleTimeString(), {
        duration: 10000,
        action: {
          label: 'Restore',
          onClick: () => {
            setTemplate(autosave.template)
            toast.success('Restored from autosave')
          },
        },
        cancel: {
          label: 'Ignore',
          onClick: () => {
            setTemplate(initialTemplate)
          },
        },
      })
    } else {
      setTemplate(initialTemplate)
    }
  }, [props.templateId])

  return (
    <EditorErrorBoundary>
      <VideoEditorLayout {...props} />
    </EditorErrorBoundary>
  )
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

  const undo = useHistoryStore((state) => state.undo)
  const redo = useHistoryStore((state) => state.redo)

  const [sidebarTab, setSidebarTab] = useState<'layers' | 'assets'>('layers')
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Multi-select store actions
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds)
  const selectAllElements = useEditorStore((state) => state.selectAllElements)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const deleteSelectedElements = useEditorStore((state) => state.deleteSelectedElements)

  // Clipboard store actions
  const copySelectedElements = useEditorStore((state) => state.copySelectedElements)
  const cutSelectedElements = useEditorStore((state) => state.cutSelectedElements)
  const pasteElements = useEditorStore((state) => state.pasteElements)

  // Snap settings
  const toggleSnap = useEditorStore((state) => state.toggleSnap)

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

      // Delete - works with both single and multi-select
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.size > 0) {
          e.preventDefault()
          deleteSelectedElements()
        } else if (selectedElementId) {
          e.preventDefault()
          deleteElement(selectedElementId)
        }
      }

      // Select All (Cmd+A)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAllElements()
      }

      // Clear Selection (Cmd+D)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        clearSelection()
      }

      // Copy (Cmd+C)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        copySelectedElements()
      }

      // Cut (Cmd+X)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        cutSelectedElements()
      }

      // Paste (Cmd+V) - paste at current playhead position
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        pasteElements(currentFrame)
      }

      // Toggle Snap (Cmd+;)
      if ((e.metaKey || e.ctrlKey) && e.key === ';') {
        e.preventDefault()
        toggleSnap()
      }

      // Toggle Shortcuts Legend (Shift + ?)
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      }

      // Undo/Redo Shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedElementId,
    selectedElementIds,
    currentFrame,
    splitElement,
    isPlaying,
    setIsPlaying,
    deleteElement,
    deleteSelectedElements,
    selectAllElements,
    clearSelection,
    copySelectedElements,
    cutSelectedElements,
    pasteElements,
    toggleSnap,
    undo,
    redo,
  ])

  // Autosave Effect
  useEffect(() => {
    const interval = setInterval(() => {
      saveToLocalStorage(templateId, template)
      toast.success('Autosaved', { duration: 1000, position: 'bottom-right' })
    }, 30000)
    return () => clearInterval(interval)
  }, [template, templateId])

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // In a real app we'd check canUndo or a dirty flag
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleSave = () => {
    onSave(template)
    clearAutosave(templateId)
    toast.success('Project saved successfully')
  }

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
        <EditorSidebar activeTab={sidebarTab} setActiveTab={setSidebarTab} onSave={handleSave} />

        {/* Side Panel (Layers or Assets) - Contextual Drawer */}
        <aside className="w-[300px] border-r border-border flex flex-col bg-[#161616]">
          {sidebarTab === 'layers' ? (
            <LayerList />
          ) : (
            <AssetErrorBoundary>
              <AssetBrowser assets={assets} assetsRoot={assetsRoot} />
            </AssetErrorBoundary>
          )}
        </aside>

        {/* Main Canvas / Player Area */}
        <section className="flex-1 flex flex-col relative overflow-hidden">
          <CanvasErrorBoundary>
            <EditorCanvas />
          </CanvasErrorBoundary>
          <TimelineErrorBoundary>
            <Timeline />
          </TimelineErrorBoundary>
        </section>

        {/* Properties Panel */}
        <aside className="w-[300px] border-l border-border bg-panel">
          <PropertiesPanel />
        </aside>
      </main>

      <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  )
}
