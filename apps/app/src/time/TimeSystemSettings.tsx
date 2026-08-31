'use client'

import { CalendarDays, Loader2 } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { gregorian } from '@nau/time'
import { useTimeSystems, useUpdateTimeSystem } from './use-time-systems'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'

const FIRST_DAY_OPTIONS = [
  { value: 1, label: 'Lunes' },
  { value: 0, label: 'Domingo' },
]

/**
 * Was `CalendarSettings`, singular and Gregorian-only. Renamed per #58: the
 * workspace's time systems, not one calendar's settings — it lists whatever
 * `/time/systems` reports rather than assuming Gregorian is the only one.
 *
 * Each system's settings are its own shape (`SystemConfig` is an opaque
 * record the system itself validates), so this can only render controls it
 * actually knows — today, Gregorian's `firstDayOfWeek`. A system with no
 * known controls still lists its name and scales; it does not get a blank
 * settings panel pretending to be Gregorian's.
 */
export function TimeSystemSettings() {
  const workspaceId = useActiveWorkspaceId()
  const { data, isLoading } = useTimeSystems(workspaceId)
  const update = useUpdateTimeSystem(workspaceId)

  return (
    <div className="space-y-4">
      {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}

      {data?.systems.map((system) => (
        <div key={system.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-1 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{system.name}</h2>
            {update.isPending && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
          </div>

          {system.id === gregorian.id ? (
            <>
              <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                Ajustes del calendario gregoriano.
              </p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-800 dark:text-gray-200">Primer día de la semana</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Cambia dónde empiezan y acaban tus semanas, y con ellas sus resúmenes.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                  {FIRST_DAY_OPTIONS.map((d) => {
                    const current = (system.config.firstDayOfWeek as number | undefined) ?? 1
                    return (
                      <button
                        key={d.value}
                        disabled={update.isPending}
                        onClick={() => update.mutate({ system: system.id, config: { firstDayOfWeek: d.value } })}
                        className={cn(
                          'rounded-md px-3 py-1 text-xs font-medium transition-all disabled:opacity-50',
                          current === d.value
                            ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
                        )}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {system.scales.length} escalas · {system.enabled ? 'Activo' : 'Inactivo'}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
