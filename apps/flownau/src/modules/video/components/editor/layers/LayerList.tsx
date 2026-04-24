'use client'

import React from 'react'
import {
  Type,
  Image as ImageIcon,
  Video as VideoIcon,
  Trash2,
  Layers,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { useEditorStore } from '@/modules/video/store/useEditorStore'
import { Tooltip } from '@/modules/video/components/ui/Tooltip'

export function LayerList() {
  const template = useEditorStore((state) => state.template)
  const selectedElementId = useEditorStore((state) => state.selectedElementId)
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds)
  const setSelectedElementId = useEditorStore((state) => state.setSelectedElementId)
  const toggleElementSelection = useEditorStore((state) => state.toggleElementSelection)
  const selectMultipleElements = useEditorStore((state) => state.selectMultipleElements)
  const deleteElement = useEditorStore((state) => state.deleteElement)
  const deleteSelectedElements = useEditorStore((state) => state.deleteSelectedElements)
  const addElement = useEditorStore((state) => state.addElement)
  const reorderElement = useEditorStore((state) => state.reorderElement)

  const [lastSelectedIndex, setLastSelectedIndex] = React.useState<number | null>(null)

  const handleLayerClick = (elementId: string, index: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl+Click: Toggle selection
      toggleElementSelection(elementId)
      setLastSelectedIndex(index)
    } else if (e.shiftKey && lastSelectedIndex !== null) {
      // Shift+Click: Range selection
      const reversedElements = [...template.elements].reverse()
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const rangeIds = reversedElements.slice(start, end + 1).map((el) => el.id)
      selectMultipleElements(rangeIds)
    } else {
      // Normal click: Single selection
      setSelectedElementId(elementId)
      setLastSelectedIndex(index)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#161616]">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Layers size={16} className="text-accent" /> Layers
          {selectedElementIds.size > 1 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold">
              {selectedElementIds.size} selected
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Tooltip content="Add Text">
            <button
              onClick={() => addElement('text')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <Type size={14} />
            </button>
          </Tooltip>
          <Tooltip content="Add Image">
            <button
              onClick={() => addElement('image')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <ImageIcon size={14} />
            </button>
          </Tooltip>
          <Tooltip content="Add Video">
            <button
              onClick={() => addElement('video')}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <VideoIcon size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {template.elements.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Layers size={32} className="mx-auto mb-4 opacity-10" />
            <p className="text-zinc-500 text-xs">No layers yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {[...template.elements].reverse().map((element, index, arr) => {
              const isFirst = index === 0
              const isSelected =
                selectedElementId === element.id || selectedElementIds.has(element.id)

              return (
                <div
                  key={element.id}
                  onClick={(e) => handleLayerClick(element.id, index, e)}
                  className={`
                                        flex justify-between items-center px-4 py-3 border-b border-white/[0.02] cursor-pointer group transition-all duration-200
                                        ${isSelected ? 'bg-accent/10 border-l-4 border-l-accent' : 'hover:bg-white/[0.02] border-l-4 border-l-transparent'}
                                    `}
                >
                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <div
                      className={`p-1.5 rounded-lg ${isSelected ? 'bg-accent/20 text-accent' : 'bg-white/5 text-zinc-500 group-hover:text-zinc-300'}`}
                    >
                      {element.type === 'text' && <Type size={14} />}
                      {element.type === 'image' && <ImageIcon size={14} />}
                      {element.type === 'video' && <VideoIcon size={14} />}
                      {element.type === 'audio' && <VideoIcon size={14} />}
                    </div>
                    <span
                      className={`truncate text-xs font-medium ${isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}
                    >
                      {element.name}
                    </span>
                  </div>

                  <div
                    className={`flex items-center gap-0.5 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <Tooltip content="Bring Forward">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          reorderElement(element.id, 'up')
                        }}
                        disabled={isFirst}
                        className="p-1.5 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors"
                      >
                        <ArrowUp size={14} />
                      </button>
                    </Tooltip>
                    <Tooltip content="Send Backward">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          reorderElement(element.id, 'down')
                        }}
                        disabled={index === arr.length - 1}
                        className="p-1.5 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </Tooltip>
                    <Tooltip
                      content={
                        selectedElementIds.size > 1
                          ? `Delete ${selectedElementIds.size} layers`
                          : 'Delete'
                      }
                      className="z-50"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (selectedElementIds.size > 1) {
                            deleteSelectedElements()
                          } else {
                            deleteElement(element.id)
                          }
                        }}
                        className="p-1.5 text-zinc-500 hover:text-error transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
