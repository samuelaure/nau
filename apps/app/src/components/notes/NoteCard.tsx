import { useState } from 'react'
import { Block, UpdateBlockDto } from '@9nau/types'
import { cn } from '@9nau/ui/lib/utils'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useUpdateNote, useDeleteNote } from '@/references/use-notes'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { notify } from '@/core/notifications/notifications-store'
import { BlockBottomBar } from '@/components/editor/BlockBottomBar'
import { BlockEditor } from '@/components/editor/BlockEditor'

interface NoteCardProps {
  note: Block
}

export function NoteCard({ note }: NoteCardProps) {
  const { setDraggedItem, draggedItem } = useDashboardStore((s) => ({
    setDraggedItem: s.actions.setDraggedItem,
    draggedItem: s.draggedItem,
  }))
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const activeWorkspaceId = useActiveWorkspaceId()

  // Domain hooks for update/delete. The note passes through the Block bridge for now
  // because the page-level data fetch is still via /blocks (nau#136). Once the
  // page migrates to useGetNotes the prop will be Note, not Block, and the
  // workspaceId will come from note.workspaceId directly.
  const updateNote = useUpdateNote(activeWorkspaceId)
  const deleteNote = useDeleteNote(activeWorkspaceId)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', note.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem(note)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'bg-card border rounded-lg shadow-sm cursor-pointer break-inside-avoid group relative flex flex-col',
        draggedItem?.id === note.id ? 'opacity-50' : 'opacity-100'
      )}
    >
      <div onClick={() => setIsEditorOpen(true)} className="p-4 flex-grow">
        {Boolean(note.properties.title) && (
          <p className="mb-1 text-sm font-medium text-card-foreground break-words">
            {note.properties.title as string}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm text-card-foreground break-words max-h-80 overflow-hidden">
          {(note.properties.text ?? note.properties.content ?? '') as string}
        </p>
      </div>
      {/* The exact same bottom bar BlockEditor's open editor renders — see
          BlockBottomBar.tsx. showClose=false: nothing is open here. */}
      <div className="px-2 pb-2 opacity-0 transition-opacity group-hover:opacity-100">
        <BlockBottomBar onDelete={() => deleteNote.mutate(note.id)} showClose={false} />
      </div>

      {/*
        Mounted locally, not through a global editingNote store — that
        indirection (NoteCard writes an id to dashboard-store, a separately-
        mounted EditNoteModal in AppProvider reads it back out and renders
        BlockEditor) was legacy wiring left over from when BlockEditorModal/
        EditNoteModal were their own editors and needed a shared place to
        live; nothing else ever read editingNote. EditableItem already
        proved the simpler shape works (local isModalOpen state, BlockEditor
        mounted right where the click happened) — this brings NoteCard in
        line with it. onMouseDown, not onClick: the click above already
        opens the editor via onClick, and a plain onClick here would fire
        after it on the same event in a way that reads as fragile; stopping
        propagation on this div keeps the two independent regardless.
      */}
      {isEditorOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <BlockEditor
            mode="overlay"
            block={note}
            onClose={() => setIsEditorOpen(false)}
            onUpdate={(id, dto: UpdateBlockDto) => {
              const props = dto.properties as Record<string, unknown> | undefined
              const body = {
                title: (props?.title as string | null) ?? null,
                content: (props?.text as string) ?? '',
              }
              // BlockEditor already closed by the time this fires (nau#153)
              // — a failure here can only be reported after the fact.
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
              setIsEditorOpen(false)
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
        </div>
      )}
    </div>
  )
}
