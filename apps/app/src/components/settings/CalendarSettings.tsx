'use client'

import { CalendarDays, Loader2 } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { useWorkspaceCalendar, useUpdateCalendar } from '@/hooks/use-calendar-api'

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 0, label: 'Domingo' },
]

/**
 * Settings that belong to the calendar, not to the person.
 *
 * Which day opens a week is a property of the Gregorian calendar: a week only
 * exists inside it. The naŭ calendar has nine-day naŭ that do not align to a
 * weekday and cannot be asked the question, and astrological transits have no
 * weeks at all — so when those arrive, each brings its own settings here rather
 * than inheriting options that make no sense for it.
 */
export function CalendarSettings() {
  const { data, isLoading } = useWorkspaceCalendar()
  const update = useUpdateCalendar()

  const firstDay = data?.config.firstDayOfWeek ?? 1

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <div className="mb-1 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Calendario</h2>
        {update.isPending && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
      </div>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Ajustes del calendario gregoriano. Cada sistema de orden tendrá los suyos.
      </p>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-800 dark:text-gray-200">Primer día de la semana</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cambia dónde empiezan y acaban tus semanas, y con ellas sus resúmenes.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {DAYS.map((d) => (
            <button
              key={d.value}
              disabled={isLoading || update.isPending}
              onClick={() => update.mutate({ firstDayOfWeek: d.value })}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all disabled:opacity-50',
                firstDay === d.value
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {data?.timezone && (
        <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-700">
          Zona horaria del workspace: <span className="font-medium">{data.timezone}</span>
        </p>
      )}
    </div>
  )
}
