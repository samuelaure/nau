'use client'

import { useMemo } from 'react'
import { addDays, subDays, format } from 'date-fns'
import { useAgendaRange, type AgendaItem } from '@/hooks/use-agenda-api'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useUiStore } from '@/lib/state/ui-store'
import { getTodayDateString } from '@9nau/core'

/** A block on a given day, together with the occurrence that put it there. */
export type Occurrences = Map<string, AgendaItem[]>

/**
 * What the Actions section shows, per day.
 *
 * The day something appears under is decided by its schedule, not by a date
 * written into its properties. That distinction is the whole point of the
 * normalisation: `properties.date` says when something *belongs* — a capture, an
 * experience — and a schedule says when it is *owed*. An action planned today
 * for Friday belongs to today and is owed on Friday, and it is Friday it should
 * appear under.
 *
 * It also makes recurrence work at all. A daily habit is one block; it shows up
 * on seven days because the schedule says so, and no amount of reading a date
 * field would have produced that.
 */
export function useDayAgenda() {
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)
  const visiblePastDays = useDashboardStore((s) => s.visiblePastDays)
  const visibleFutureDays = useDashboardStore((s) => s.visibleFutureDays)

  const span = useMemo(() => {
    const today = new Date(getTodayDateString() + 'T00:00:00')
    return {
      from: format(subDays(today, Math.max(0, visiblePastDays - 1)), 'yyyy-MM-dd'),
      to: format(addDays(today, visibleFutureDays), 'yyyy-MM-dd'),
    }
  }, [visiblePastDays, visibleFutureDays])

  const { data, isLoading } = useAgendaRange({
    from: span.from,
    to: span.to,
    period: 'daily',
    workspaceId: activeWorkspaceId ?? undefined,
  })

  /**
   * Grouped by the day each row says to draw it under.
   *
   * `shownAt` rather than `occurrenceAt`, because a carried task is drawn under
   * today while staying recorded against the day it was planned for — and the
   * two are the same for everything else.
   */
  const byDay = useMemo<Occurrences>(() => {
    const map: Occurrences = new Map()
    for (const item of data?.items ?? []) {
      // The server resolved this in the workspace's zone. Slicing the ISO string
      // here would answer for UTC, which in Madrid moves the boundary by an hour.
      const day = item.day
      const list = map.get(day)
      if (list) list.push(item)
      else map.set(day, [item])
    }
    return map
  }, [data?.items])

  return { byDay, timezone: data?.timezone ?? 'UTC', isLoading }
}
