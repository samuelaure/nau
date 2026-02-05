'use client'

import React from 'react'
import { X, Command, Keyboard, Zap, Scissors, Copy, Layers, Grid } from 'lucide-react'

interface ShortcutCategory {
  name: string
  icon: React.ReactNode
  shortcuts: {
    keys: string[]
    description: string
  }[]
}

const SHORTCUTS: ShortcutCategory[] = [
  {
    name: 'General',
    icon: <Command size={14} />,
    shortcuts: [
      { keys: ['Space'], description: 'Play / Pause' },
      { keys: ['⌘', 'Z'], description: 'Undo' },
      { keys: ['⌘', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['?'], description: 'Show Shortcuts' },
    ],
  },
  {
    name: 'Timeline & Tools',
    icon: <Scissors size={14} />,
    shortcuts: [
      { keys: ['S'], description: 'Split at Playhead' },
      { keys: ['Del'], description: 'Delete Selected' },
      { keys: ['⌘', ';'], description: 'Toggle Snap' },
      { keys: ['⌘', 'A'], description: 'Select All' },
      { keys: ['⌘', 'D'], description: 'Deselect All' },
    ],
  },
  {
    name: 'Clipboard',
    icon: <Copy size={14} />,
    shortcuts: [
      { keys: ['⌘', 'C'], description: 'Copy' },
      { keys: ['⌘', 'X'], description: 'Cut' },
      { keys: ['⌘', 'V'], description: 'Paste' },
    ],
  },
  {
    name: 'Selection (Mouse)',
    icon: <Layers size={14} />,
    shortcuts: [
      { keys: ['Click'], description: 'Select Layer' },
      { keys: ['⌘', 'Click'], description: 'Multi-Select' },
      { keys: ['Shift', 'Click'], description: 'Range Select' },
    ],
  },
]

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1C1C1C] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Keyboard size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
              <p className="text-xs text-text-secondary">Master your workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {SHORTCUTS.map((category) => (
            <div key={category.name} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-wider mb-1">
                {category.icon}
                <span>{category.name}</span>
              </div>
              <div className="flex flex-col gap-2">
                {category.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between group p-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-sm text-text-secondary group-hover:text-white transition-colors">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd
                          key={keyIdx}
                          className="px-2 py-1 min-w-[24px] text-center rounded bg-white/10 border border-white/5 text-[10px] font-mono font-bold text-gray-300 shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-white/[0.02] flex justify-between items-center text-[11px] text-text-secondary">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-yellow-400" />
            <span>Pro tip: Use shortcuts to speed up your editing by 2x</span>
          </div>
          <div className="flex items-center gap-4">
            <span>⌘ = Ctrl on Windows</span>
          </div>
        </div>
      </div>
    </div>
  )
}
