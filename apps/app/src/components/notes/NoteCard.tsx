import { Block } from '@9nau/types'
import { cn } from '@9nau/ui/lib/utils'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useDeleteNote } from '@/references/use-notes'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { BlockBottomBar } from '@/components/editor/BlockBottomBar'

interface NoteCardProps {
  note: Block
}

export function NoteCard({ note }: NoteCardProps) {
  const { setDraggedItem, draggedItem, setEditingNoteId } = useDashboardStore((s) => ({
    setDraggedItem: s.actions.setDraggedItem,
    draggedItem: s.draggedItem,
    setEditingNoteId: s.actions.setEditingNoteId,
  }))
  const activeWorkspaceId = useActiveWorkspaceId()

  // Domain hook for delete. The note passes through the Block bridge for now
  // because the page-level data fetch is still via /blocks (nau#136). Once the
  // page migrates to useGetNotes the prop will be Note, not Block, and the
  // workspaceId will come from note.workspaceId directly.
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
      <div onClick={() => setEditingNoteId(note.id)} className="p-4 flex-grow">
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
    </div>
  )
}
