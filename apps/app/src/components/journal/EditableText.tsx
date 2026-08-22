'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@9nau/ui/lib/utils'

/**
 * Text that becomes editable when clicked.
 *
 * Saves on blur and on Ctrl/Cmd+Enter; Escape restores what was there before.
 * Nothing is written when the text comes back unchanged, so opening an entry to
 * read it never marks it as edited — which matters, because an edit flag changes
 * which version of the entry the summaries read.
 */
export function EditableText({
  value,
  onSave,
  placeholder = 'Vacío',
  className,
  rows = 3,
  label,
}: {
  value: string
  onSave: (next: string) => void
  placeholder?: string
  className?: string
  rows?: number
  label?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  // The value can change underneath while not editing — another device, a
  // regenerated summary. Adopting it mid-edit would delete what is being typed.
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (!editing || !ref.current) return
    const el = ref.current
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing])

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next === value.trim()) return
    onSave(next)
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        title={label ? `Editar ${label}` : 'Editar'}
        className={cn(
          'cursor-text whitespace-pre-wrap rounded-md -mx-1 px-1 py-0.5 transition-colors',
          'hover:bg-gray-100/70 dark:hover:bg-gray-700/40',
          !value && 'italic text-gray-400 dark:text-gray-500',
          className,
        )}
      >
        {value || placeholder}
      </div>
    )
  }

  return (
    <textarea
      ref={ref}
      value={draft}
      rows={rows}
      onChange={(e) => {
        setDraft(e.target.value)
        e.target.style.height = 'auto'
        e.target.style.height = `${e.target.scrollHeight}px`
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          commit()
        }
      }}
      className={cn(
        'w-full resize-none rounded-md border border-emerald-300 bg-white px-2 py-1 outline-none',
        'focus:border-emerald-500 dark:border-emerald-700 dark:bg-gray-900',
        className,
      )}
    />
  )
}
