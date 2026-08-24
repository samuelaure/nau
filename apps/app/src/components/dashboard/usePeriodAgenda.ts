'use client'

import { useMemo } from 'react'
import { useAgendaRange, type AgendaItem } from '@/hooks/use-agenda-api'
import { useUiStore } from '@/lib/state/ui-store'
import { API_PERIOD, periodOf, toKey, type PeriodSlot } from '@/lib/periods'

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
    period: (span ? API_PERIOD[span.granularity] : 'daily') as never,
    workspaceId: span ? activeWorkspaceId ?? undefined : undefined,
  })

  /**
   * Grouped by the period each row belongs to.
   *
   * The server resolved each row's calendar day in the workspace's zone, so the
   * only thing left here is deciding which slot that day falls in — arithmetic,
   * and no timezone reasoning on the client.
   */
  const byPeriod = useMemo<OccurrencesByPeriod>(() => {
    const map: OccurrencesByPeriod = new Map()
    if (!span) return map

    for (const item of data?.items ?? []) {
      const key = periodOf(new Date(`${item.day}T12:00:00`), span.granularity).key
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return map
  }, [data?.items, span])

  return { byPeriod, timezone: data?.timezone ?? 'UTC', isLoading }
}
