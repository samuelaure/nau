import { useState } from 'react'
import { Block } from '@9nau/types'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { NoteGrid } from './NoteGrid'

interface NotesInboxSectionProps {
  title: string
  notes: Block[]
  /** A line under the title, after it — Bandeja's date-based groups opt in; PeriodBlock's own section doesn't, to avoid a visual change unrelated to this feature. */
  withDivider?: boolean
}

export function NotesInboxSection({ title, notes, withDivider = false }: NotesInboxSectionProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="mb-4">
      <button
        className="flex w-full flex-col text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center rounded-md p-2 hover:bg-gray-50 dark:hover:bg-gray-800">
          {isOpen ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        {withDivider && <div className={cn('mx-2 border-t border-gray-200 dark:border-gray-800')} />}
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
