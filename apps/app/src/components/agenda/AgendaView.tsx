'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight, Clock, ListChecks, CornerDownRight } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { cn } from '@9nau/ui/lib/utils'
import {
  useAgenda,
  useSetCompletion,
  useReorderAgenda,
  type AgendaItem,
  type AgendaPeriod,
} from '@/hooks/use-agenda-api'
import { useUpsertPlanning } from '@/hooks/use-schedule-api'
import { useUiStore } from '@/lib/state/ui-store'
import { AgendaRow } from './AgendaRow'
import { ItemComposer } from './ItemComposer'
import { toKey } from '@/relations/app-actions/periods'
import { stepDate } from '@/relations/app-time/scroll-window'

function shift(date: Date, scale: AgendaPeriod, direction: -1 | 1): Date {
  return stepDate(date, scale, direction)
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const PERIODS: { value: AgendaPeriod; label: string; composerDefault: 'today' | 'week' | 'month' }[] = [
  { value: 'day', label: 'Día', composerDefault: 'today' },
  { value: 'week', label: 'Semana', composerDefault: 'week' },
  { value: 'month', label: 'Mes', composerDefault: 'month' },
]

/**
 * Everything due in a period, in one list.
 *
 * Habits and tasks share the list and share the ordering. Tools that split them
 * into two panes leave the person to merge them mentally every morning, which is
 * the work the tool was supposed to do.
 */
export function AgendaView() {
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)
  const [date, setDate] = useState(() => new Date())
  const [period, setPeriod] = useState<AgendaPeriod>('day')

  const { data, isLoading } = useAgenda({
    date: toKey(date),
    scale: period,
    workspaceId: activeWorkspaceId ?? undefined,
  })

  const setCompletion = useSetCompletion()
  const reorder = useReorderAgenda()
  const upsertPlanning = useUpsertPlanning()

  // Held locally so a drag lands instantly; the server order arrives back on the
  // next fetch and replaces it.
  const [order, setOrder] = useState<AgendaItem[]>([])
  useEffect(() => setOrder(data?.items ?? []), [data?.items])

  const sensors = useSensors(
    // A small threshold so a tap on the checkbox is never read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = useMemo(() => order.map((i) => `${i.blockId}@${i.occurrenceAt}`), [order])

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return

    const next = arrayMove(order, from, to)
    setOrder(next)

    // Order belongs to the block, not the occurrence: dragging a habit above a
    // task means it comes first every day, not only today. Duplicates collapse
    // because a recurring block appears once per occurrence in a week view.
    const blockIds = Array.from(new Set(next.map((i) => i.blockId)))
    reorder.mutate({ blockIds, workspaceId: activeWorkspaceId ?? undefined })
  }

  /**
   * Pushes something to the next day by hand.
   *
   * Distinct from the automatic carry-over, and recorded as such: this is a
   * decision, and the counter that shows it is the one that should make a person
   * uncomfortable after the third time.
   */
  const defer = (item: AgendaItem) => {
    const from = new Date(item.occurrenceAt)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)

    upsertPlanning.mutate({
      blockId: item.blockId,
      scale: 'day',
      anchor: to.toISOString(),
      recurrence: null,
    })
  }

  const pending = order.filter((i) => !i.done && !i.projected).length

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agenda</h1>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                period === p.value
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setDate(shift(date, period, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <button
          onClick={() => setDate(new Date())}
          className="text-lg font-semibold capitalize text-gray-800 transition-colors hover:text-emerald-600 dark:text-gray-100 dark:hover:text-emerald-400"
        >
          {data?.label ?? '…'}
        </button>
        <Button variant="ghost" size="icon" onClick={() => setDate(shift(date, period, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <ItemComposer
        workspaceId={activeWorkspaceId ?? undefined}
        defaultWhen={PERIODS.find((p) => p.value === period)?.composerDefault ?? 'today'}
        defaultDate={date}
      />

      {data && order.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{pending} pendientes</span>
          {data.plannedMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(data.plannedMinutes)} planificados
            </span>
          )}
          {data.unestimatedCount > 0 && (
            <span className="text-gray-400 dark:text-gray-500">
              · {data.unestimatedCount} sin estimar
            </span>
          )}
          {data.carriedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <CornerDownRight className="h-3 w-3" />
              {data.carriedCount} viene de antes
            </span>
          )}
        </div>
      )}

      {isLoading && <p className="mt-10 text-center text-gray-500 dark:text-gray-400">Cargando…</p>}

      {!isLoading && order.length === 0 && (
        <div className="py-16 text-center">
          <ListChecks className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-400 dark:text-gray-500">Nada planificado para este periodo</p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {order.map((item) => (
              <AgendaRow
                key={`${item.blockId}@${item.occurrenceAt}`}
                item={item}
                timezone={data?.timezone ?? 'UTC'}
                onToggle={(it, done) =>
                  setCompletion.mutate({
                    blockId: it.blockId,
                    occurrenceAt: it.occurrenceAt,
                    done,
                  })
                }
                onDefer={defer}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
