'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Repeat, CornerDownRight, MoveRight, Sparkle, CalendarRange } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { Block } from '@9nau/types'
import { EditableItem } from './EditableItem'
import type { AgendaItem } from '@/hooks/use-agenda-api'
import { useSetCompletion } from '@/hooks/use-agenda-api'
import { useUpsertSchedule } from '@/hooks/use-schedule-api'
import { rangeOf, WHEN_LABELS, type WhenKind } from '@/components/agenda/scheduling'
import { useCreateBlock, useUpdateBlock, useDeleteBlock } from '@/hooks/use-blocks-api'
import { useDashboardStore } from '@/lib/state/dashboard-store'

/**
 * How late something is, as a background wash.
 *
 * Lateness arrives as a multiple of the schedule's own interval, so a daily
 * habit and a monthly one deepen at the same *relative* point rather than the
 * same number of days. Fully red at two intervals: one is a slip, two is a
 * decision not to do it.
 */
function overdueTint(overdue: number): string {
  if (overdue <= 0) return ''
  if (overdue < 0.5) return 'bg-amber-50/60 dark:bg-amber-500/5'
  if (overdue < 1) return 'bg-amber-100/70 dark:bg-amber-500/10'
  if (overdue < 2) return 'bg-orange-100/70 dark:bg-orange-500/15'
  return 'bg-red-100/80 dark:bg-red-500/20'
}

/**
 * The marks a row carries.
 *
 * Silence means everything is in order, so a row with nothing to say shows
 * nothing at all. Any badge is information the person needs — which is the
 * agreement that lets the agenda's metadata live inside home's clean rows
 * without turning every line into a dashboard.
 */
/**
 * Moves one item to another period.
 *
 * Sits on the right of the row, away from the text, because it is a control and
 * not an annotation. The full hierarchical navigator replaces this list later;
 * these four cover the moves that actually happen daily.
 */
function MoveTo({ item, onMove }: { item: AgendaItem; onMove: (when: WhenKind) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Mover a…"
        className="rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 dark:text-gray-600 dark:hover:bg-gray-700"
      >
        <CalendarRange className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {(['today', 'week', 'month'] as WhenKind[]).map((kind) => (
            <button
              key={kind}
              onClick={() => {
                onMove(kind)
                setOpen(false)
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {WHEN_LABELS[kind]}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

function Badges({ item }: { item: AgendaItem }) {
  const carriedOn = item.carriedFrom
    ? new Date(item.carriedFrom).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : null

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1.5 align-middle text-[10px] text-gray-400 dark:text-gray-500">
      {item.isHabit && (
        <span className="inline-flex items-center gap-0.5" title="Hábito">
          <Repeat className="h-3 w-3" />
        </span>
      )}
      {item.projected && (
        <span className="inline-flex items-center gap-0.5 italic" title="Estimado: depende de cuándo hagas el anterior">
          <Sparkle className="h-3 w-3" /> estimado
        </span>
      )}
      {carriedOn && (
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          title={`Sin completar desde el ${carriedOn}`}
        >
          <CornerDownRight className="h-3 w-3" />×{item.carriedPeriods}
        </span>
      )}
      {item.rescheduledCount > 0 && (
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-px font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-400"
          title="Veces que la has pospuesto a mano"
        >
          <MoveRight className="h-3 w-3" />×{item.rescheduledCount}
        </span>
      )}
    </span>
  )
}

/**
 * The actions and habits owed on one day.
 *
 * What appears here is decided by schedules, never by a date written into a
 * block: a daily habit is one block that shows up on seven days, and no date
 * field can express that. The blocks themselves still come from the block query,
 * because that is what carries the text, the tree and the editing.
 */
export function ActionsSection({
  dateStr,
  occurrences,
  blocksById,
  workspaceId,
}: {
  dateStr: string
  occurrences: AgendaItem[]
  blocksById: Map<string, Block>
  workspaceId?: string
}) {
  const [isOpen, setIsOpen] = useState(true)
  const setCompletion = useSetCompletion()
  const createBlock = useCreateBlock()
  const updateBlock = useUpdateBlock()
  const deleteBlock = useDeleteBlock()
  const upsertSchedule = useUpsertSchedule()
  const setFocusedItemId = useDashboardStore((s) => s.actions.setFocusedItemId)

  /**
   * Puts an item in another period without going there.
   *
   * Planning something for next month is not wanting to be in next month, so
   * the view stays where it is.
   */
  const moveTo = (item: AgendaItem, kind: WhenKind) => {
    const { start, end } = rangeOf({ kind })
    upsertSchedule.mutate({
      blockId: item.blockId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rrule: item.recurring ? undefined : null,
    })
  }
  const setDraggedItem = useDashboardStore((s) => s.actions.setDraggedItem)
  const setDropTarget = useDashboardStore((s) => s.actions.setDropTarget)

  /**
   * Enter creates the next line, and schedules it for this day in the same
   * breath.
   *
   * The schedule is not optional. A block without one exists but is due nowhere,
   * which is exactly how six actions came to sit invisibly outside the agenda —
   * and typing should never be able to produce that.
   */
  const handleAdd = async (_afterId: string | null, parentId: string | null) => {
    const start = new Date(`${dateStr}T00:00:00`)
    const end = new Date(`${dateStr}T23:59:59.999`)

    const created = await createBlock.mutateAsync({
      type: 'action',
      parentId: parentId ?? undefined,
      workspaceId,
      properties: { text: '', status: 'todo' },
      // One request. Typing a line and putting it on a day is a single act, and
      // splitting it into two calls made every Enter wait for two round trips
      // and two refetches.
      schedule: { startDate: start.toISOString(), endDate: end.toISOString(), rrule: null },
    })

    setFocusedItemId(created.id)
  }

  const handleUpdate = (id: string, text: string) =>
    updateBlock.mutate({ id, updateDto: { properties: { text } } })

  const handleIndent = (id: string) => {
    const index = occurrences.findIndex((o) => o.blockId === id)
    const previous = occurrences[index - 1]
    if (!previous || previous.blockId === id) return
    updateBlock.mutate(
      { id, updateDto: { parentId: previous.blockId } },
      { onSuccess: () => setFocusedItemId(id) },
    )
  }

  const handleOutdent = (id: string) => {
    const item = occurrences.find((o) => o.blockId === id)
    if (!item?.parentId) return
    const grandParent = occurrences.find((o) => o.blockId === item.parentId)?.parentId ?? null
    updateBlock.mutate(
      { id, updateDto: { parentId: grandParent } },
      { onSuccess: () => setFocusedItemId(id) },
    )
  }

  /**
   * The rows to draw, as a tree.
   *
   * A child whose parent is not owed today is drawn at root: the section is
   * about what is due, and pulling in a parent that is not would put a block in
   * a day it does not belong to.
   */
  const rows = useMemo(() => {
    const owed = new Set(occurrences.map((o) => o.blockId))
    const roots = occurrences.filter((o) => !o.parentId || !owed.has(o.parentId))
    const childrenOf = (blockId: string) => occurrences.filter((o) => o.parentId === blockId)
    return { roots, childrenOf }
  }, [occurrences])

  const render = (items: AgendaItem[], level = 0): JSX.Element[] =>
    items.flatMap((item) => {
      const block = blocksById.get(item.blockId)
      if (!block) return []

      const children = rows.childrenOf(item.blockId)

      return [
        <div
          key={`${item.blockId}@${item.occurrenceAt}`}
          style={{ marginLeft: level > 0 ? '1.5rem' : 0 }}
          className={cn('rounded-md', overdueTint(item.overdue))}
        >
          <EditableItem
            item={block}
            occurrence={item}
            parentList={[]}
            index={0}
            onUpdate={handleUpdate}
            onAddItem={(_after, parentId) => void handleAdd(_after, parentId)}
            onIndent={handleIndent}
            onOutdent={handleOutdent}
            onDelete={(id) => deleteBlock.mutate(id)}
            onDragStart={(_e, dragged) => setDraggedItem(dragged)}
            onDragEnd={() => {
              setDraggedItem(null)
              setDropTarget(null)
            }}
            onToggle={() =>
              setCompletion.mutate({
                blockId: item.blockId,
                occurrenceAt: item.occurrenceAt,
                done: !item.done,
              })
            }
            badges={<Badges item={item} />}
            trailing={<MoveTo item={item} onMove={(kind) => moveTo(item, kind)} />}
          />
          {children.length > 0 && render(children, level + 1)}
        </div>,
      ]
    })

  return (
    <div className="mb-4">
      <button
        className="flex w-full items-center rounded-md p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Actions</h3>
        {occurrences.length > 0 && (
          <span className="ml-2 text-[10px] text-gray-400">
            {occurrences.filter((o) => !o.done && !o.projected).length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-2 pl-2">
          {occurrences.length > 0 ? (
            render(rows.roots)
          ) : (
            <div
              className="flex h-10 cursor-pointer items-center pl-8 text-sm italic text-gray-400"
              onClick={() => void handleAdd(null, null)}
            >
              Click to add an entry.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
