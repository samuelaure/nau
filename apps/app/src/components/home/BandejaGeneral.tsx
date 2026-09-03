import { Block } from '@9nau/types'
import { NoteGrid } from '@/components/notes/NoteGrid'

interface BandejaGeneralProps {
  notes: Block[]
}

/**
 * The GTD General tray, Keep-equivalent: every captured note, as cards —
 * grid or list per `notesViewMode` (`NoteGrid` reads that itself). No date
 * grouping, no Futuro/Pasado paging — those belong to `Dashboard`'s
 * period-scroll view, which is a different surface (the old, still-unbuilt
 * Time/Actions period view), not this tray. Ordered newest first, same as
 * Keep orders by last-touched.
 */
export function BandejaGeneral({ notes }: BandejaGeneralProps) {
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (sorted.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
        Tu bandeja está vacía.
      </div>
    )
  }

  return <NoteGrid notes={sorted} />
}
