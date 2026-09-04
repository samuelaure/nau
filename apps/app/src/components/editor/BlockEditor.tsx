'use client'

import * as React from 'react'
import { cn } from '@9nau/ui/lib/utils'
import { Card } from '@9nau/ui/components/card'
import { useCreateNote } from '@/references/use-notes'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { BlockBottomBar } from './BlockBottomBar'
import type { Block, UpdateBlockDto } from '@9nau/types'

/**
 * The one editor for opening, creating, or capturing a block — the merge of
 * three things that used to be separate: `NoteInput`'s Keep-style collapsed
 * card, `BlockEditorModal`'s open editor (title, body, bottom toolbar), and
 * `EditNoteModal`'s save-on-click-outside. All three are now this one
 * component in two `mode`s:
 *
 * - `inline`: collapsed is the quiet "Take a note…" card; expanded grows
 *   in place with the content, capped the same way the overlay is.
 * - `overlay`: opens directly into the expanded editor as a centered
 *   `fixed inset-0` modal — same editor, different mount point.
 *
 * Named for what it now actually is — no longer just a capture box (it
 * edits, not only creates), not tied to Home, not tied to notes or any one
 * block type.
 *
 * Both modes save on an outside click; there is no explicit save button,
 * same as `BlockEditorModal`'s reasoning: closing is the confirmation.
 *
 * Differences from the old `BlockEditorModal` the merge introduces: no
 * borders, no divider between the body and the bottom toolbar, and
 * "Eliminar" moved off the toolbar into a `MoreVertical` menu — the pattern
 * `EditNoteModal`/`NoteCard` already used for delete.
 *
 * The entire bottom row (`BlockBottomBar`, wrapping `BlockToolbar`) is
 * shared with `NoteCard`'s on-hover controls, so the two never drift apart
 * — `NoteCard` passes `showClose={false}`, since a hovered card has
 * nothing to close.
 */
export function BlockEditor({
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
  const containerRef = React.useRef<HTMLDivElement>(null)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)

  const createNote = useCreateNote()
  const activeWorkspaceId = useActiveWorkspaceId()

  React.useEffect(() => {
    if (!block) return
    const props = block.properties as Record<string, unknown>
    // A kind that actually carries a `title` field (References' notes —
    // `noteToBlock` always sets it, even to null) must never fall back to
    // showing its body there: a title-less note has to keep showing the
    // placeholder, not a duplicate of its own content. That duplicate was
    // also why edits silently failed to save — title always "changed"
    // relative to itself, masking whether the body actually changed, and
    // comparing against the wrong baseline.
    //
    // A kind with no title concept at all (Actions — `actionToBlock` never
    // sets `properties.title`) has always used its one text field as the
    // "title" row here, same as the pre-merge BlockEditorModal did — it
    // never had a body field either.
    if ('title' in props) {
      setTitle((props.title ?? '') as string)
      setBody((props.body ?? props.text ?? '') as string)
    } else {
      setTitle((props.text ?? props.summary ?? props.name ?? '') as string)
      setBody((props.body as string) ?? '')
    }
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
    const hasTitleField = 'title' in props
    const nextTitle = title.trim()
    const nextBody = body.trim()
    // Each field compared against its own original value — same
    // hasTitleField distinction as the load effect above, so a title-less
    // kind's one text field isn't compared as if it were two.
    let changed: boolean
    let nextProperties: Record<string, unknown>
    if (hasTitleField) {
      const originalTitle = (props.title ?? '') as string
      const originalBody = (props.body ?? props.text ?? '') as string
      changed = nextTitle !== originalTitle || nextBody !== originalBody
      nextProperties = { ...props, title: nextTitle || null, text: nextBody, body: nextBody || undefined }
    } else {
      const originalText = (props.text ?? props.summary ?? props.name ?? '') as string
      const originalBody = (props.body as string) ?? ''
      changed = nextTitle !== originalText || nextBody !== originalBody
      nextProperties = { ...props, text: nextTitle, body: nextBody || undefined }
    }
    if (changed) {
      onUpdate?.(block.id, { properties: nextProperties })
    }
    if (mode === 'overlay') onClose?.()
    else setExpanded(false)
  }

  // Bound to the latest handler on every render, so the outside-click
  // listener below never closes over a stale commit.
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

  const handleDelete = () => {
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
      {/* Title and body share one scroll container so a long body scrolls
          the title away with it, rather than leaving the title pinned above
          an independently-scrolling textarea. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
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
          // Deliberately not flex-1 and no overflow-y of its own: scrolling
          // now belongs to the wrapper above so title+body move together.
          // scrollHeight auto-resize (the effect above) still drives this
          // textarea's own height; the wrapper's overflow-y only kicks in
          // once that combined height exceeds the editor's max-h.
          className="w-full resize-none bg-transparent px-5 py-3 text-sm leading-relaxed text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-300"
        />
      </div>

      {/* No border-t here — the merge drops the divider between body and
          toolbar that BlockEditorModal had. */}
      <div className="flex flex-col gap-1 px-3 py-2">
        {block && (
          <div className="flex justify-end px-2">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              Editado {new Date(block.updatedAt).toLocaleString('es-ES', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}

        <BlockBottomBar
          // Recurrence ("isHabit") lives on the agenda occurrence shape
          // (use-agenda-api.ts), not on Block — BlockEditor only ever holds
          // a Block, so there's no real source for this here yet. The old
          // computation read a `schedule.rrule` field Block never had (a
          // shape abandoned in nau#93); dropped rather than left pretending
          // to work. Wire this once BlockEditor can be opened with agenda
          // context, or drop the prop if that never happens.
          isHabit={false}
          onDelete={handleDelete}
          canDelete={!!block}
          onClose={commit}
          errorMessage={createNote.isError ? 'No se pudo guardar. El texto sigue aquí.' : null}
        />
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
