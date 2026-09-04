import { Block } from '@9nau/types'
import { NoteGrid } from '@/components/notes/NoteGrid'
import { NotesInboxSection } from '@/components/notes/NotesInboxSection'
import { formatDisplayDate } from '@9nau/core'
import { useNotesViewStore } from '@/components/notes/notes-view-store'

interface BandejaGeneralProps {
  notes: Block[]
}

/**
 * naŭ's actual GTD General tray (root, `ROOT_TRAY_ID`) — not "every note",
 * only blocks GTD's own event log currently places in it (captured, not
 * yet processed/ordered out; see `home/page.tsx`'s `trayNotes` filter
 * against `useTrayContents`). Rendered Keep-equivalent, as cards — grid or
 * list per `notesViewMode` (`NoteGrid` reads that itself). No Futuro/Pasado
 * paging — that belongs to `Dashboard`'s period-scroll view, a different
 * surface (the old, still-unbuilt Time/Actions period view), not this
 * tray. Grouping (`groupBy`, from the content topbar's selector) is
 * optional and off by default — `none` renders the same flat list this
 * always has. Ordered newest first within each group, same as Keep orders
 * by last-touched.
 */
export function BandejaGeneral({ notes }: BandejaGeneralProps) {
  const groupBy = useNotesViewStore((s) => s.groupBy)

  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (sorted.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
        Tu bandeja está vacía.
      </div>
    )
  }

  if (groupBy === 'none') {
    return <NoteGrid notes={sorted} />
  }

  const dateField = groupBy === 'createdAt' ? 'createdAt' : 'updatedAt'
  const groups = new Map<string, Block[]>()
  for (const note of sorted) {
    const key = formatDisplayDate(new Date(note[dateField]).toISOString().split('T')[0])
    const list = groups.get(key)
    if (list) list.push(note)
    else groups.set(key, [note])
  }

  return (
    <div>
      {Array.from(groups.entries()).map(([label, groupNotes]) => (
        <NotesInboxSection key={label} title={label} notes={groupNotes} withDivider />
      ))}
    </div>
  )
}
