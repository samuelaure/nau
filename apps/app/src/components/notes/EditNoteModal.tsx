'use client'

import { useUpdateNote, useDeleteNote } from '@/references/use-notes'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { notify } from '@/core/notifications/notifications-store'
import { BlockEditor } from '@/components/editor/BlockEditor'

/**
 * Wires the globally-mounted overlay (see `AppProvider`) to whichever note
 * `NoteCard` put into `dashboard-store.editingNote`.
 *
 * `EditNoteModal` used to be its own editor; it is now just this wiring —
 * the actual editor is `BlockEditor` in `overlay` mode, the same component
 * `EditableItem`'s "Expand item" opens for actions. One editor, two call
 * sites, instead of two editors that happened to look similar.
 */
export function EditNoteModal() {
  const { editingNote, setEditingNoteId } = useDashboardStore((s) => ({
    editingNote: s.editingNote,
    setEditingNoteId: s.actions.setEditingNoteId,
  }))

  // `editingNote` is still a Block from the global block store — `content`
  // lives under `properties.text` for the old-style notes while the
  // `/blocks` bridge is alive. `Block` never carried `workspaceId` (packages/
  // types), so the active workspace comes from the same store `NoteCard.tsx`
  // already reads it from, not from the note itself.
  const activeWorkspaceId = useActiveWorkspaceId()
  const updateNote = useUpdateNote(activeWorkspaceId)
  const deleteNote = useDeleteNote(activeWorkspaceId)

  if (!editingNote) return null

  return (
    <BlockEditor
      mode="overlay"
      block={editingNote}
      onClose={() => setEditingNoteId(null)}
      onUpdate={(id, dto) => {
        const props = dto.properties as Record<string, unknown> | undefined
        const body = {
          title: (props?.title as string | null) ?? null,
          content: (props?.text as string) ?? '',
        }
        // BlockEditor already closed by the time this fires (see its
        // docstring — nau#153) — a failure here can only be reported after
        // the fact, never by keeping the modal open.
        updateNote.mutate(
          { id, body },
          {
            onError: () =>
              notify({
                tone: 'error',
                message: 'No se pudo guardar la edición de la nota.',
                action: { label: 'Reintentar', onClick: () => updateNote.mutate({ id, body }) },
              }),
          },
        )
      }}
      onDelete={(id) => {
        setEditingNoteId(null)
        deleteNote.mutate(id, {
          onError: () =>
            notify({
              tone: 'error',
              message: 'No se pudo eliminar la nota.',
              action: { label: 'Reintentar', onClick: () => deleteNote.mutate(id) },
            }),
        })
      }}
    />
  )
}
