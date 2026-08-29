'use client'

import { useMemo } from 'react'
import { useAgendaRange, type AgendaItem } from '@/hooks/use-agenda-api'
import { useUiStore } from '@/lib/state/ui-store'
import { usePeriodsIn } from '@/relations/app-time/use-periods'
import { toKey, toSlot, type PeriodSlot } from '@/relations/app-actions/periods'

/** Occurrences owed, keyed by the period they are drawn under. */
export type OccurrencesByPeriod = Map<string, AgendaItem[]>

/**
 * What each period on screen owes.
 *
 * The period something appears under is decided by its schedule, never by a date
 * written into its properties. That distinction is the point of the
 * normalisation: `properties.date` says when something *belongs* — a capture, an
 * experience — and a schedule says when it is *owed*. An action planned today
 * for Friday belongs to today and is owed on Friday, and it is Friday it should
 * appear under.
 *
 * It is also the only way recurrence works at all. A daily habit is one block
 * that shows on seven days, and no amount of reading a date field produces that.
 */
export function usePeriodAgenda(slots: PeriodSlot[]) {
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)

  const span = useMemo(() => {
    if (slots.length === 0) return null
    const starts = slots.map((s) => s.start.getTime())
    const ends = slots.map((s) => s.end.getTime())
    return {
      from: toKey(new Date(Math.min(...starts))),
      to: toKey(new Date(Math.max(...ends))),
      granularity: slots[0]!.granularity,
    }
  }, [slots])

  const { data, isLoading } = useAgendaRange({
    from: span?.from ?? '',
    to: span?.to ?? '',
    period: (span?.granularity ?? 'day') as never,
    workspaceId: span ? activeWorkspaceId ?? undefined : undefined,
  })

  // Which period each day of the span falls in, resolved by the server in one
  // request rather than one `usePeriodAt` call per row — the same shape of fix
  // the server-resolved periods migration made everywhere else: the client
  // asks once for the whole window instead of recomputing membership itself.
  const { data: periodsData } = usePeriodsIn({
    scale: span?.granularity ?? 'day',
    from: span?.from ?? '',
    to: span?.to ?? '',
    workspaceId: span ? activeWorkspaceId ?? null : null,
  })

  const slotByDay = useMemo(() => {
    const resolved = (periodsData?.periods ?? []).map(toSlot)
    return (day: Date) => resolved.find((slot) => day >= slot.start && day <= slot.end) ?? null
  }, [periodsData])

  /**
   * Grouped by the period each row belongs to.
   *
   * The server resolved both the row's calendar day and the window's periods,
   * so what is left here is matching one against the other — arithmetic, and
   * no timezone reasoning or period-boundary calculation on the client.
   */
  const byPeriod = useMemo<OccurrencesByPeriod>(() => {
    const map: OccurrencesByPeriod = new Map()
    if (!span) return map

    for (const item of data?.items ?? []) {
      const slot = slotByDay(new Date(`${item.day}T12:00:00`))
      const key = slot?.key ?? item.day
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return map
  }, [data?.items, span, slotByDay])

  return { byPeriod, timezone: data?.timezone ?? 'UTC', isLoading }
}
