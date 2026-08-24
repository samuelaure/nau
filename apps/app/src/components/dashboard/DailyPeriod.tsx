import { useState } from 'react'
import { cn } from '@9nau/ui/lib/utils'
import { ChevronDown } from 'lucide-react'
import { Block } from '@9nau/types'
import { HierarchicalSection } from './HierarchicalSection'
import { ActionsSection } from './ActionsSection'
import type { AgendaItem } from '@/hooks/use-agenda-api'
import { NotesInboxSection } from '../notes/NotesInboxSection'
import { formatDisplayDate, isDateToday, HierarchicalBlock } from '@9nau/core'
import { useDashboardStore } from '@/lib/state/dashboard-store'

interface DailyPeriodProps {
  dateStr: string
  /** What the schedules say is owed today. Not a date-filtered list of blocks. */
  occurrences: AgendaItem[]
  blocksById: Map<string, Block>
  dailyExperiences: HierarchicalBlock[]
  dailyNotes: Block[]
  showHeader?: boolean
  workspaceId?: string
}

export function DailyPeriod({
  dateStr,
  occurrences,
  blocksById,
  dailyExperiences,
  dailyNotes,
  showHeader = true,
  workspaceId,
}: DailyPeriodProps) {
  const [isOpen, setIsOpen] = useState(() => isDateToday(dateStr))
  const { setDropTarget } = useDashboardStore((s) => ({
    setDropTarget: s.actions.setDropTarget,
  }))

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const draggedItem = useDashboardStore.getState().draggedItem
    if (draggedItem && draggedItem.type !== 'note') {
      setDropTarget({
        id: null,
        position: 'end',
        date: dateStr,
        section: draggedItem.type, // Drop into the correct section type for that day
      })
    }
  }

  const inboxNotes = dailyNotes.filter((note) => note.properties.status === 'inbox')
  const sortedNotes = [...inboxNotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const content = (
    <div
      data-testid={`daily-period-content-${dateStr}`}
      className={cn(showHeader && 'pt-4 pl-4 border-l-2 ml-2')}
      onDragOver={handleDragOver}
    >
      <ActionsSection
        dateStr={dateStr}
        occurrences={occurrences}
        blocksById={blocksById}
        workspaceId={workspaceId}
      />
      <HierarchicalSection
        dateStr={dateStr}
        sectionType="experience"
        title="Experiences & Gratitude"
        items={dailyExperiences}
      />
      <NotesInboxSection title="Notes Inbox" notes={sortedNotes} />
    </div>
  )

  if (!showHeader) return content

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
        onDragOver={handleDragOver}
      >
        <span className="text-sm font-bold text-gray-600">{formatDisplayDate(dateStr)}</span>
        <ChevronDown className={cn('h-5 w-5 text-gray-500 transition-transform', isOpen ? 'rotate-180' : '')} />
      </button>
      {isOpen && content}
    </div>
  )
}
