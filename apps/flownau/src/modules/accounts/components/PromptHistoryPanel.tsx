'use client'

import { useState, useCallback } from 'react'
import { History, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

export interface PromptHistoryEntry {
  id: string
  content: string
  activeSince: string
  replacedAt: string | null
}

interface Props {
  entityType: string
  entityId: string
  field: string
  onRestore: (content: string) => void
}

function formatRange(activeSince: string, replacedAt: string | null): string {
  const from = new Date(activeSince).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  if (!replacedAt) return `Active since ${from}`
  const to = new Date(replacedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${from} → ${to}`
}

export function PromptHistoryPanel({ entityType, entityId, field, onRestore }: Props) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<PromptHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/prompt-history?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}&field=${field}`)
      const { entries } = await res.json()
      setEntries(entries ?? [])
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, field])

  const toggle = () => {
    if (!open) load()
    setOpen(v => !v)
  }

  if (!entityId) return null

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        <History size={12} />
        Prompt history
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="mt-2 border border-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <p className="text-xs text-gray-600 px-3 py-2">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-gray-600 px-3 py-2">No history yet — changes will appear here after saving.</p>
          ) : (
            <ul className="divide-y divide-gray-800">
              {entries.map((entry) => {
                const isExpanded = expanded === entry.id
                const preview = entry.content.length > 120 ? entry.content.slice(0, 120) + '…' : entry.content
                const isCurrent = !entry.replacedAt
                return (
                  <li key={entry.id} className="px-3 py-2 text-xs bg-gray-950">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`${isCurrent ? 'text-green-500' : 'text-gray-500'} shrink-0`}>
                        {formatRange(entry.activeSince, entry.replacedAt)}
                        {isCurrent && <span className="ml-1.5 bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded text-[10px]">current</span>}
                      </span>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => onRestore(entry.content)}
                          className="flex items-center gap-1 text-gray-500 hover:text-white transition-colors shrink-0"
                          title="Restore this version"
                        >
                          <RotateCcw size={11} />
                          Restore
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : entry.id)}
                      className="mt-1 text-left text-gray-500 hover:text-gray-300 transition-colors font-mono leading-relaxed"
                    >
                      {isExpanded ? entry.content : preview}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
