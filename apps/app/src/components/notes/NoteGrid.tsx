import { Block } from '@9nau/types'
import { NoteCard } from './NoteCard'
import { useShellStore } from '@/core/shell/shell-store'

interface NoteGridProps {
  notes: Block[]
}

export function NoteGrid({ notes }: NoteGridProps) {
  const notesViewMode = useShellStore((s) => s.notesViewMode)

  if (notesViewMode === 'list') {
    // Same max-width as CaptureBox (max-w-xl), so a card reads like the
    // capture box itself grown downward, not a table row stretched to the
    // full content column.
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-2">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </div>
    )
  }

  return (
    <div
      style={{
        columnCount: 'auto',
        columnWidth: '240px',
        columnGap: '1rem',
      }}
    >
      {notes.map((note) => (
        <div key={note.id} className="mb-4 break-inside-avoid">
          <NoteCard note={note} />
        </div>
      ))}
    </div>
  )
}
