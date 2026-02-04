'use client'

import React from 'react'
import { Layers, Image as ImageIcon, Save, Sparkles, Undo2, Redo2 } from 'lucide-react'
import { useHistoryStore } from '../../store/useHistoryStore'

interface EditorSidebarProps {
  activeTab: 'layers' | 'assets'
  setActiveTab: (tab: 'layers' | 'assets') => void
  onSave: () => void
}

export function EditorSidebar({ activeTab, setActiveTab, onSave }: EditorSidebarProps) {
  const undo = useHistoryStore((state) => state.undo)
  const redo = useHistoryStore((state) => state.redo)
  const canUndo = useHistoryStore((state) => state.canUndo)
  const canRedo = useHistoryStore((state) => state.canRedo)

  return (
    <aside className="w-[64px] border-r border-border flex flex-col items-center py-6 gap-6 bg-panel z-20">
      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-2">
        <Sparkles size={20} />
      </div>

      <div className="w-8 h-px bg-border" />

      <div className="flex flex-col gap-2 w-full px-2">
        <ToolButton
          icon={<Layers size={20} />}
          label="Layers"
          onClick={() => setActiveTab('layers')}
          active={activeTab === 'layers'}
        />
        <ToolButton
          icon={<ImageIcon size={20} />}
          label="Assets"
          onClick={() => setActiveTab('assets')}
          active={activeTab === 'assets'}
        />

        <div className="h-px bg-border my-2" />

        <ToolButton
          icon={<Undo2 size={20} />}
          label="Undo"
          onClick={undo}
          active={false}
          disabled={!canUndo}
        />
        <ToolButton
          icon={<Redo2 size={20} />}
          label="Redo"
          onClick={redo}
          active={false}
          disabled={!canRedo}
        />
      </div>

      <div className="flex-1" />

      <div className="w-full px-2 pb-2">
        <button
          onClick={onSave}
          className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all duration-200"
        >
          <Save size={20} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Save</span>
        </button>
      </div>
    </aside>
  )
}

function ToolButton({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
                flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-xl transition-all duration-300 relative group
                ${active ? 'text-accent bg-accent/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}
                ${disabled ? 'opacity-20 cursor-not-allowed grayscale' : 'opacity-100'}
            `}
    >
      {active && <div className="absolute left-0 top-3 bottom-3 w-1 bg-accent rounded-r-full" />}
      <div
        className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}
      >
        {icon}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  )
}
