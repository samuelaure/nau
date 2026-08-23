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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, GripVertical, Repeat, CalendarRange, Clock, ListChecks } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { cn } from '@9nau/ui/lib/utils'
import { useAgenda, useSetCompletion, useReorderAgenda, type AgendaItem, type AgendaPeriod } from '@/hooks/use-agenda-api'
import { useUiStore } from '@/lib/state/ui-store'

function toInputDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function shift(date: Date, period: AgendaPeriod, direction: -1 | 1): Date {
  const d = new Date(date)
  if (period === 'daily') d.setDate(d.getDate() + direction)
  if (period === 'weekly') d.setDate(d.getDate() + 7 * direction)
  if (period === 'monthly') d.setMonth(d.getMonth() + direction)
  return d
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** One agenda line. A habit and a task look alike on purpose. */
function Row({
  item,
  onToggle,
  timezone,
}: {
  item: AgendaItem
  onToggle: (item: AgendaItem, done: boolean) => void
  timezone: string
}) {
  const id = `${item.blockId}@${item.occurrenceAt}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const time = new Date(item.effectiveAt).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-white p-3 dark:bg-gray-800',
        'border-gray-100 dark:border-gray-700',
        isDragging && 'opacity-60 shadow-lg',
        item.done && 'opacity-60',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
        className="cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing dark:text-gray-600"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <input
        type="checkbox"
        checked={item.done}
        onChange={(e) => onToggle(item, e.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
      />

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm text-gray-800 dark:text-gray-200', item.done && 'line-through')}>
          {item.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
          {item.recurring ? (
            <span className="inline-flex items-center gap-1">
              <Repeat className="h-3 w-3" /> hábito
            </span>
          ) : (
            <span className="uppercase">{item.type}</span>
          )}
          {/* Deferred to the period rather than to a moment in it: showing a
              clock time here would invent a precision the plan never had. */}
          {item.spansPeriod ? (
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="h-3 w-3" /> en el periodo
            </span>
          ) : (
            <span>{time}</span>
          )}
          {item.moved && <span>· movido</span>}
          {item.estimateMinutes != null && <span>· {formatDuration(item.estimateMinutes)}</span>}
          {item.priority && <span>· {item.priority}</span>}
        </div>
      </div>
    </div>
  )
}

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
  const [period, setPeriod] = useState<AgendaPeriod>('daily')

  const { data, isLoading } = useAgenda({
    date: toInputDate(date),
    period,
    workspaceId: activeWorkspaceId ?? undefined,
  })

  const setCompletion = useSetCompletion()
  const reorder = useReorderAgenda()

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

  const pending = order.filter((i) => !i.done).length

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agenda</h1>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {([
            { value: 'daily', label: 'Día' },
            { value: 'weekly', label: 'Semana' },
            { value: 'monthly', label: 'Mes' },
          ] as const).map((p) => (
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

      {data && order.length > 0 && (
        <div className="mb-4 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
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
              <Row
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
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
