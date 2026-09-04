import { useState } from 'react'
import { Block } from '@9nau/types'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { NoteGrid } from './NoteGrid'

interface NotesInboxSectionProps {
  title: string
  notes: Block[]
  /** A line after the title, vertically centered with it, filling the rest of the row — Bandeja's date-based groups opt in; PeriodBlock's own section doesn't, to avoid a visual change unrelated to this feature. */
  withDivider?: boolean
}

export function NotesInboxSection({ title, notes, withDivider = false }: NotesInboxSectionProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="mb-4">
      <button
        className="flex w-full items-center rounded-md p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown className="w-4 h-4 mr-2 shrink-0" /> : <ChevronRight className="w-4 h-4 mr-2 shrink-0" />}
        <h3 className="shrink-0 text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        {withDivider && <div className={cn('ml-3 h-px flex-1 bg-gray-200 dark:bg-gray-800')} />}
      </button>
      {isOpen && (
        <div className="pl-2 mt-2">
          {notes.length > 0 ? (
            <NoteGrid notes={notes} />
          ) : (
            <p className="text-gray-500 italic text-sm pl-8">No inbox notes for this day.</p>
          )}
        </div>
      )}
    </div>
  )
}
