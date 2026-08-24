'use client'

import { useState } from 'react'
import { cn } from '@9nau/ui/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Block } from '@9nau/types'
import { HierarchicalSection } from './HierarchicalSection'
import { ActionsSection } from './ActionsSection'
import { NotesInboxSection } from '../notes/NotesInboxSection'
import { HierarchicalBlock } from '@9nau/core'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import type { AgendaItem } from '@/hooks/use-agenda-api'
import { isCurrent, SUB_GRANULARITY, type PeriodSlot } from '@/lib/periods'

export interface PeriodContents {
  occurrences: AgendaItem[]
  experiences: HierarchicalBlock[]
  notes: Block[]
}

/**
 * One period, with everything that belongs to it.
 *
 * The three sections are the same three at every grain: what is owed, what was
 * lived, and what was captured and not yet processed. A week is not a different
 * kind of thing from a day — it holds the same three answers over a longer span.
 */
export function PeriodBlock({
  slot,
  contents,
  blocksById,
  workspaceId,
  showHeader = true,
  onDrillDown,
  renderSubPeriod,
}: {
  slot: PeriodSlot
  contents: PeriodContents
  blocksById: Map<string, Block>
  workspaceId?: string
  showHeader?: boolean
  /** Switches the whole list to this period's grain. */
  onDrillDown?: (slot: PeriodSlot) => void
  /** Draws one level of sub-periods in place, when the grain has one. */
  renderSubPeriod?: (sub: PeriodSlot) => React.ReactNode
}) {
  const current = isCurrent(slot)
  const [isOpen, setIsOpen] = useState(current)
  const [showSubPeriods, setShowSubPeriods] = useState(false)
  const { setDropTarget } = useDashboardStore((s) => ({ setDropTarget: s.actions.setDropTarget }))

  const sub = SUB_GRANULARITY[slot.granularity]

  // Counts every kind of entry, because at home a period is empty only when
  // nothing at all happened in it. A tab that shows one type counts only that
  // type, which is the same rule applied to a narrower list.
  const total =
    contents.occurrences.length + contents.experiences.length + contents.notes.length
  const isEmpty = total === 0

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const draggedItem = useDashboardStore.getState().draggedItem
    if (draggedItem && draggedItem.type !== 'note') {
      setDropTarget({ id: null, position: 'end', date: slot.key, section: draggedItem.type })
    }
  }

  const content = (
    <div
      data-testid={`period-content-${slot.key}`}
      className={cn(showHeader && 'ml-2 border-l-2 pl-4 pt-4', current && 'border-emerald-400')}
      onDragOver={handleDragOver}
    >
      <ActionsSection
        dateStr={slot.key}
        periodStart={slot.start.toISOString()}
        periodEnd={slot.end.toISOString()}
        occurrences={contents.occurrences}
        blocksById={blocksById}
        workspaceId={workspaceId}
      />
      <HierarchicalSection
        dateStr={slot.key}
        sectionType="journal_entry"
        title="Experiencias"
        items={contents.experiences}
        workspaceId={workspaceId}
      />
      <NotesInboxSection title="Notes Inbox" notes={contents.notes} />

      {/* One level in place. Going deeper switches grain instead of nesting
          further: toggles inside toggles inside a scroll stop being readable at
          about the third, and the value of a higher period is seeing its parts
          next to what was planned across the whole of it. */}
      {sub && renderSubPeriod && (
        <div className="mt-4">
          <button
            onClick={() => setShowSubPeriods((v) => !v)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            {showSubPeriods ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {sub === 'day' ? 'Días' : 'Meses'}
          </button>
          {showSubPeriods && <div className="mt-2 space-y-3 pl-2">{renderSubPeriod(slot)}</div>}
        </div>
      )}
    </div>
  )

  if (!showHeader) return content

  return (
    <div>
      <div
        className={cn(
          'flex w-full items-center gap-2 rounded-md transition-colors',
          current
            ? 'bg-emerald-50 ring-1 ring-emerald-300 dark:bg-emerald-900/20 dark:ring-emerald-700'
            : 'bg-gray-100 dark:bg-gray-800',
          // A period nothing happened in reads as quieter, so scanning a month of
          // them shows where the life was without having to open any.
          isEmpty && !current && 'opacity-55',
        )}
        onDragOver={handleDragOver}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex flex-1 items-center gap-2 p-2 text-left"
        >
          <ChevronDown
            className={cn('h-5 w-5 shrink-0 text-gray-500 transition-transform', isOpen ? 'rotate-180' : '')}
          />
          <span
            className={cn(
              'text-sm font-bold capitalize',
              current ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-600 dark:text-gray-300',
            )}
          >
            {slot.label}
          </span>
          {!isEmpty && (
            <span className="text-[10px] font-medium text-gray-400" title={`${total} entradas`}>
              {total}
            </span>
          )}
        </button>

        {onDrillDown && SUB_GRANULARITY[slot.granularity] && (
          <button
            onClick={() => onDrillDown(slot)}
            title={`Ver por ${SUB_GRANULARITY[slot.granularity] === 'day' ? 'días' : 'meses'}`}
            className="mr-2 rounded-md p-1 text-gray-400 transition-colors hover:bg-white/60 hover:text-gray-700 dark:hover:bg-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {isOpen && content}
    </div>
  )
}
