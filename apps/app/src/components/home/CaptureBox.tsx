'use client'

import * as React from 'react'
import { Trash, Tag, Repeat, Clock, Calendar, MoreVertical } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { Card } from '@9nau/ui/components/card'
import { Button } from '@9nau/ui/components/button'
import { useCreateNote } from '@/references/use-notes'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import type { Block, UpdateBlockDto } from '@9nau/types'

/**
 * The one composer for opening or capturing a block — the merge of three
 * things that used to be separate: `NoteInput`'s Keep-style collapsed card,
 * `BlockEditorModal`'s open editor (title, body, bottom toolbar), and
 * `EditNoteModal`'s save-on-click-outside. All three are now this one
 * component in two `mode`s:
 *
 * - `inline`: collapsed is the quiet "Take a note…" card; expanded grows
 *   in place with the content, capped the same way the overlay is.
 * - `overlay`: opens directly into the expanded editor as a centered
 *   `fixed inset-0` modal — same editor, different mount point.
 *
 * Both modes save on an outside click; there is no explicit save button,
 * same as `BlockEditorModal`'s reasoning: closing is the confirmation.
 *
 * Differences from the old `BlockEditorModal` the merge introduces: no
 * borders, no divider between the body and the bottom toolbar, and
 * "Eliminar" moved off the toolbar into a `MoreVertical` menu — the pattern
 * `EditNoteModal`/`NoteCard` already used for delete.
 */
export function CaptureBox({
  mode = 'inline',
  block = null,
  onUpdate,
  onDelete,
  onClose,
}: {
  mode?: 'inline' | 'overlay'
  /** The block being edited. Absent means "capturing a new note" — inline mode only. */
  block?: Block | null
  onUpdate?: (id: string, dto: UpdateBlockDto) => void
  onDelete?: (id: string) => void
  /** Required for `overlay` — how the host un-mounts this. */
  onClose?: () => void
}) {
  // Inline-without-a-block starts collapsed, Keep-style. Overlay and
  // editing an existing block both start open — there is no collapsed state
  // for either.
  const [isExpanded, setExpanded] = React.useState(mode === 'overlay' || block !== null)
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const createNote = useCreateNote()
  const activeWorkspaceId = useActiveWorkspaceId()

  React.useEffect(() => {
    if (!block) return
    const props = block.properties as Record<string, unknown>
    setTitle((props.title ?? props.text ?? props.summary ?? props.name ?? '') as string)
    setBody((props.body ?? props.text ?? '') as string)
  }, [block])

  React.useEffect(() => {
    if (!bodyRef.current) return
    bodyRef.current.style.height = 'auto'
    bodyRef.current.style.height = `${bodyRef.current.scrollHeight}px`
  }, [body, isExpanded])

  /**
   * Saves, and only then clears or closes.
   *
   * Capturing (no `block`) creates a note via References and resets to the
   * collapsed card. Editing an existing block reports the change up through
   * `onUpdate` and closes (overlay) or collapses back (inline, though
   * nothing currently opens an existing block inline).
   */
  const commit = () => {
    if (isMenuOpen) return

    if (!block) {
      const trimmed = body.trim()
      if (!trimmed) {
        setExpanded(false)
        return
      }
      createNote.mutate(
        {
          content: trimmed,
          title: title.trim() || null,
          workspaceId: activeWorkspaceId ?? undefined,
        },
        {
          onSuccess: () => {
            setTitle('')
            setBody('')
            setExpanded(false)
          },
        },
      )
      return
    }

    const props = block.properties as Record<string, unknown>
    const nextTitle = title.trim()
    const nextBody = body.trim()
    const changed = nextTitle !== ((props.title ?? props.text) || '') || nextBody !== ((props.body ?? props.text) || '')
    if (changed) {
      onUpdate?.(block.id, {
        properties: { ...props, title: nextTitle, text: nextTitle, body: nextBody || undefined },
      })
    }
    if (mode === 'overlay') onClose?.()
    else setExpanded(false)
  }

  // Bound to the latest handler on every render, same as the old CaptureBox.
  const commitRef = React.useRef(commit)
  commitRef.current = commit

  React.useEffect(() => {
    // Overlay mode has its own outside-click handler on the backdrop
    // (`onMouseDown={commit}` below) — listening globally here too would
    // fire commit twice for the same click.
    if (!isExpanded || mode === 'overlay') return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        commitRef.current()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded, mode])

  React.useEffect(() => {
    if (!isMenuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isMenuOpen])

  const isHabit = Boolean((block as { schedule?: { rrule?: string } } | null)?.schedule?.rrule)

  const handleDelete = () => {
    setIsMenuOpen(false)
    if (block) onDelete?.(block.id)
    if (mode === 'overlay') onClose?.()
  }

  if (!isExpanded) {
    return (
      <div className="max-w-xl mx-auto mb-8">
        <Card className="p-3 cursor-text text-gray-500" onClick={() => setExpanded(true)}>
          Take a note...
        </Card>
      </div>
    )
  }

  const editor = (
    <div
      ref={containerRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape') commit()
      }}
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-xl bg-card shadow-2xl',
        mode === 'overlay' ? 'max-h-[80vh] max-w-2xl' : 'max-h-[85vh]',
      )}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        autoFocus={mode === 'overlay'}
        className="w-full bg-transparent px-5 pt-5 text-lg font-medium text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
      />

      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Escribe algo…"
        rows={mode === 'overlay' ? 4 : 1}
        autoFocus={mode === 'inline'}
        className="w-full flex-1 resize-none overflow-y-auto bg-transparent px-5 py-3 text-sm leading-relaxed text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-300"
      />

      {/* No border-t here — the merge drops the divider between body and
          toolbar that BlockEditorModal had. */}
      <div className="flex items-center gap-1 px-3 py-2">
        <ToolbarButton title="Recordatorio" icon={Clock} disabled />
        <ToolbarButton title="Frecuencia" icon={Repeat} disabled active={isHabit} />
        <ToolbarButton title="Mover a…" icon={Calendar} disabled />
        <ToolbarButton title="Etiquetas" icon={Tag} disabled />

        <div ref={menuRef} className="relative ml-auto">
          <button
            onClick={() => setIsMenuOpen((o) => !o)}
            aria-label="Más opciones"
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {isMenuOpen && (
            <div className="absolute bottom-full right-0 mb-1 w-36 rounded-md border bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <button
                onClick={handleDelete}
                disabled={!block}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/40"
              >
                <Trash className="h-3.5 w-3.5" />
                Eliminar
              </button>
            </div>
          )}
        </div>

        {createNote.isError && (
          <span className="text-xs text-red-600">No se pudo guardar. El texto sigue aquí.</span>
        )}
      </div>
    </div>
  )

  if (mode === 'overlay') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
        onMouseDown={commit}
      >
        <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-2xl">
          {editor}
        </div>
      </div>
    )
  }

  return <div className="max-w-xl mx-auto mb-8">{editor}</div>
}

function ToolbarButton({
  title,
  icon: Icon,
  onClick,
  disabled,
  active,
}: {
  title: string
  icon: React.ElementType
  onClick?: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      title={disabled ? `${title} — próximamente` : title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full p-2 transition-colors',
        'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700',
        active && 'text-emerald-600 dark:text-emerald-400',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-gray-400',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
