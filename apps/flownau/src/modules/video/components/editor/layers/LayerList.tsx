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

export function LayerList() {
  const template = useEditorStore((state) => state.template)
  const selectedElementId = useEditorStore((state) => state.selectedElementId)
  const setSelectedElementId = useEditorStore((state) => state.setSelectedElementId)
  const deleteElement = useEditorStore((state) => state.deleteElement)
  const addElement = useEditorStore((state) => state.addElement)
  const reorderElement = useEditorStore((state) => state.reorderElement)

  return (
    <div className="flex flex-col h-full bg-[#161616]">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Layers size={16} className="text-accent" /> Layers
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => addElement('text')}
            title="Add Text"
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            <Type size={14} />
          </button>
          <button
            onClick={() => addElement('image')}
            title="Add Image"
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            <ImageIcon size={14} />
          </button>
          <button
            onClick={() => addElement('video')}
            title="Add Video"
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            <VideoIcon size={14} />
          </button>
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
              const isSelected = selectedElementId === element.id

              return (
                <div
                  key={element.id}
                  onClick={() => setSelectedElementId(element.id)}
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        reorderElement(element.id, 'up')
                      }}
                      disabled={isFirst}
                      className="p-1.5 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors"
                      title="Bring Forward"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        reorderElement(element.id, 'down')
                      }}
                      disabled={index === arr.length - 1}
                      className="p-1.5 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors"
                      title="Send Backward"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteElement(element.id)
                      }}
                      className="p-1.5 text-zinc-500 hover:text-error transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
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
