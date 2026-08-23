'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Repeat, CalendarRange, CornerDownRight, MoveRight, Sparkle } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import type { AgendaItem } from '@/hooks/use-agenda-api'

/**
 * How late something is, as a background wash.
 *
 * The server reports lateness as a multiple of the schedule's own interval, so a
 * daily habit and a monthly one turn red at the same *relative* point rather
 * than the same number of days. Fully red at two intervals late: one interval is
 * a slip, two is a decision not to do it.
 */
function overdueTint(overdue: number): string {
  if (overdue <= 0) return ''
  if (overdue < 0.5) return 'bg-amber-50/60 dark:bg-amber-500/5'
  if (overdue < 1) return 'bg-amber-100/70 dark:bg-amber-500/10'
  if (overdue < 2) return 'bg-orange-100/70 dark:bg-orange-500/15'
  return 'bg-red-100/80 dark:bg-red-500/20'
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/**
 * One agenda line.
 *
 * A habit and a task look alike on purpose — they share the list because that is
 * how a day is lived — and differ in exactly one glyph. The shapes are the
 * author's own, decided in 2022: a square is completed, a circle is performed.
 */
export function AgendaRow({
  item,
  timezone,
  onToggle,
  onDefer,
}: {
  item: AgendaItem
  timezone: string
  onToggle: (item: AgendaItem, done: boolean) => void
  onDefer: (item: AgendaItem) => void
}) {
  const id = `${item.blockId}@${item.occurrenceAt}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const time = new Date(item.effectiveAt).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  })

  const carriedOn = item.carriedFrom
    ? new Date(item.carriedFrom).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3',
        'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800',
        overdueTint(item.overdue),
        isDragging && 'opacity-60 shadow-lg',
        item.done && 'opacity-60',
        // A projection is a guess about a day that depends on a completion that
        // has not happened. It is shown so a week looks like a week, and muted
        // so it is never mistaken for something that was planned.
        item.projected && 'border-dashed opacity-60',
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
        disabled={item.projected}
        onChange={(e) => onToggle(item, e.target.checked)}
        aria-label={item.isHabit ? 'Marcar como hecho' : 'Marcar como completada'}
        className={cn(
          'h-4 w-4 shrink-0 cursor-pointer border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed',
          // Square completes, circle is performed.
          item.isHabit ? 'rounded-full' : 'rounded-[3px]',
        )}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm text-gray-800 dark:text-gray-200',
            item.done && 'line-through',
          )}
        >
          {item.title}
        </p>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400 dark:text-gray-500">
          {item.isHabit ? (
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

          {item.projected && (
            <span className="inline-flex items-center gap-1 text-gray-400">
              <Sparkle className="h-3 w-3" /> estimado
            </span>
          )}

          {/* Two counters, because they mean different things. Time passing is
              not a decision, and one number would hide which happened. */}
          {carriedOn && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-px font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              title={`Sin completar desde el ${carriedOn}`}
            >
              <CornerDownRight className="h-3 w-3" />
              arrastrada ×{item.carriedPeriods}
            </span>
          )}

          {item.rescheduledCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-px font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-400"
              title="Veces que la has pospuesto a mano"
            >
              <MoveRight className="h-3 w-3" />
              pospuesta ×{item.rescheduledCount}
            </span>
          )}

          {item.moved && <span>· movido</span>}
          {item.estimateMinutes != null && <span>· {formatDuration(item.estimateMinutes)}</span>}
          {item.priority && <span>· {item.priority}</span>}
        </div>
      </div>

      {!item.done && !item.projected && !item.isHabit && (
        <button
          onClick={() => onDefer(item)}
          title="Posponer a mañana"
          className="shrink-0 rounded-md p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-600 dark:hover:bg-gray-700"
        >
          <MoveRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
