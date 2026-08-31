'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Repeat, Square, Circle } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { useCreateBlock, useUpdateBlock } from '@/hooks/use-blocks-api'
import { useUpsertPlanning } from '@/hooks/use-schedule-api'
import { toKey } from '@/actions/periods'
import {
  rruleOf,
  modeOf,
  scaleOf,
  FREQUENCY_LABELS,
  WHEN_LABELS,
  type FrequencyKind,
  type FrequencyValue,
  type WhenKind,
  type WhenValue,
} from './scheduling'

const WHEN_KINDS: WhenKind[] = ['today', 'week', 'month', 'date']
const FREQUENCY_KINDS: FrequencyKind[] = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'monthly',
  'everyNDays',
  'afterNDays',
]

/**
 * Puts something on the agenda.
 *
 * One form for actions and habits, because they differ in exactly one field.
 * Adding a frequency is what makes it a habit — there is no type to choose, and
 * no way to end up with a habit that has no rhythm or a task that repeats by
 * accident.
 */
export function ItemComposer({
  workspaceId,
  defaultWhen = 'today',
  defaultDate,
  onCreated,
}: {
  workspaceId?: string
  defaultWhen?: WhenKind
  defaultDate?: Date
  onCreated?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState<WhenValue>({
    kind: defaultWhen,
    date: toKey(defaultDate ?? new Date()),
  })
  const [frequency, setFrequency] = useState<FrequencyValue>({ kind: 'none', n: 3 })
  const [estimate, setEstimate] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setWhen((w) => ({ ...w, kind: defaultWhen, date: toKey(defaultDate ?? new Date()) }))
  }, [defaultWhen, defaultDate])

  const createBlock = useCreateBlock()
  const upsertPlanning = useUpsertPlanning()
  const busy = createBlock.isPending || upsertPlanning.isPending

  const isHabit = frequency.kind !== 'none'

  const submit = async () => {
    const text = title.trim()
    if (!text) return
    setError(null)

    try {
      const minutes = Number(estimate)
      const block = await createBlock.mutateAsync({
        // The type stays 'action'. What makes it a habit is the frequency, and
        // deriving that means adding or removing one never needs a second write.
        type: 'action',
        workspaceId,
        properties: {
          text,
          status: 'todo',
          ...(Number.isFinite(minutes) && minutes > 0 ? { estimateMinutes: minutes } : {}),
        },
      })

      const anchor =
        when.kind === 'date' && when.date ? new Date(`${when.date}T00:00:00`) : new Date()

      await upsertPlanning.mutateAsync({
        blockId: block.id,
        scale: scaleOf(when.kind),
        anchor: anchor.toISOString(),
        recurrence: rruleOf(frequency),
        recurrenceMode: modeOf(frequency),
      })

      // Cleared only once both writes land. A block with no schedule is due
      // nowhere, so losing the form halfway would strand it off the agenda.
      setTitle('')
      setEstimate('')
      onCreated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-300 p-3 text-sm text-gray-400 transition-colors hover:border-emerald-400 hover:text-emerald-600 dark:border-gray-600 dark:text-gray-500"
      >
        <Plus className="h-4 w-4" /> Añadir a la agenda
      </button>
    )
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center gap-2">
        {isHabit ? (
          <Circle className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <Square className="h-4 w-4 shrink-0 text-gray-400" />
        )}
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={isHabit ? '¿Qué hábito?' : '¿Qué hay que hacer?'}
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-gray-400">
          Cuándo
          <select
            value={when.kind}
            onChange={(e) => setWhen({ ...when, kind: e.target.value as WhenKind })}
            className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm normal-case text-gray-900 dark:border-gray-600 dark:text-gray-100"
          >
            {WHEN_KINDS.map((k) => (
              <option key={k} value={k}>
                {WHEN_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        {when.kind === 'date' && (
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-gray-400">
            Fecha
            <input
              type="date"
              value={when.date ?? ''}
              onChange={(e) => setWhen({ ...when, date: e.target.value })}
              className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:text-gray-100"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-gray-400">
          Frecuencia
          <select
            value={frequency.kind}
            onChange={(e) => setFrequency({ ...frequency, kind: e.target.value as FrequencyKind })}
            className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm normal-case text-gray-900 dark:border-gray-600 dark:text-gray-100"
          >
            {FREQUENCY_KINDS.map((k) => (
              <option key={k} value={k}>
                {FREQUENCY_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        {(frequency.kind === 'everyNDays' || frequency.kind === 'afterNDays') && (
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-gray-400">
            Días
            <input
              type="number"
              min={1}
              value={frequency.n ?? 3}
              onChange={(e) => setFrequency({ ...frequency, n: Number(e.target.value) })}
              className="w-16 rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:text-gray-100"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-gray-400">
          Estimación
          <input
            type="number"
            min={0}
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            placeholder="min"
            className="w-20 rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:text-gray-100"
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || !title.trim()}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-40',
              isHabit ? 'bg-emerald-600' : 'bg-neutral-900 dark:bg-white dark:text-neutral-900',
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isHabit ? <Repeat className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isHabit ? 'Crear hábito' : 'Crear acción'}
          </button>
        </div>
      </div>

      {frequency.kind === 'afterNDays' && (
        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          Cuenta desde la última vez que lo hiciste. Si lo haces tarde, el siguiente se retrasa
          con él.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
