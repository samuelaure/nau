import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Granularity } from '@/relations/actions/periods'

/**
 * The rhythm vocabulary (`daily`/`weekly`/`monthly`) and the scale vocabulary
 * (`day`/`week`/`month`) used to coexist on either side of the wire, translated
 * back and forth for no reason — `apps/api/src/agenda/agenda.controller.ts`'s
 * own comment on `SCALES` says so. The server now speaks scale only; this type
 * is `Granularity`, kept as its own name here because "the grain an agenda
 * view is drawn at" is what every caller in this file actually means, and
 * spelling out `Granularity` at each use site would say less, not more.
 */
export type AgendaPeriod = Granularity

export interface AgendaItem {
  blockId: string
  type: string
  title: string
  /** The instant the schedule predicted. Completion is recorded against this. */
  occurrenceAt: string
  effectiveAt: string
  moved: boolean
  /** Which period to draw the row under. Differs from effectiveAt only when carried. */
  shownAt: string
  /** The calendar day it belongs to, in the workspace's zone. Computed server-side. */
  day: string
  /** Due at some point inside the period rather than at a moment in it. */
  spansPeriod: boolean
  recurring: boolean
  /** Derived from having a recurrence. There is no stored habit type. */
  isHabit: boolean
  /** An estimate rather than a commitment. Only anchored schedules produce these. */
  projected: boolean
  done: boolean
  sortOrder: number
  estimateMinutes: number | null
  priority: string | null
  /** Where it hangs in the tree. Null for a root item of its day. */
  parentId: string | null
  /** Set when shown outside the period it was planned for; carries the original date. */
  carriedFrom: string | null
  /** Periods elapsed since it was planned. Time passing, not a decision. */
  carriedPeriods: number
  /** Times it was moved by hand. A decision, counted separately. */
  rescheduledCount: number
  /** How far past due, as a multiple of the schedule's own interval. */
  overdue: number
}

export interface Agenda {
  scale: AgendaPeriod
  label: string
  start: string
  end: string
  timezone: string
  items: AgendaItem[]
  /** Minutes still to do. Finished work does not make a day look busier. */
  plannedMinutes: number
  unestimatedCount: number
  carriedCount: number
}

export const useAgenda = (params: { date: string; scale: AgendaPeriod; workspaceId?: string }) =>
  useQuery<Agenda, Error>({
    queryKey: ['agenda', params],
    queryFn: () => {
      const search = new URLSearchParams({ date: params.date, scale: params.scale })
      if (params.workspaceId) search.append('workspaceId', params.workspaceId)
      return apiClient.get(`/agenda?${search.toString()}`)
    },
    enabled: Boolean(params.workspaceId),
  })

/**
 * Ticks one occurrence.
 *
 * Optimistic, because a checklist that waits for a round trip before the tick
 * appears feels broken — and the write is small enough that a rollback is cheap.
 */
export const useSetCompletion = () => {
  const queryClient = useQueryClient()
  return useMutation<
    unknown,
    Error,
    { blockId: string; occurrenceAt: string; done: boolean },
    { previous: Array<[readonly unknown[], Agenda | undefined]> }
  >({
    mutationFn: (input) => apiClient.post('/agenda/complete', input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['agenda'] })
      const previous = queryClient.getQueriesData<Agenda>({ queryKey: ['agenda'] })

      queryClient.setQueriesData<Agenda>({ queryKey: ['agenda'] }, (old) => {
        if (!old) return old
        return {
          ...old,
          items: old.items.map((i) =>
            i.blockId === input.blockId && i.occurrenceAt === input.occurrenceAt
              ? { ...i, done: input.done }
              : i,
          ),
        }
      })

      return { previous }
    },
    onError: (_err, _input, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      // Completion writes an event, which is what the journal reads to narrate
      // the day.
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
    },
  })
}

export const useReorderAgenda = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { blockIds: string[]; workspaceId?: string }) =>
      apiClient.post('/agenda/reorder', input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agenda'] }),
  })
}

/**
 * Occurrences across a span of periods, for a view that shows many at once.
 *
 * Home lists a run of days, so asking one period at a time would be a request
 * per day on screen. Every row carries `shownAt`, so grouping them back into
 * days is arithmetic here rather than a second expansion of the same rules.
 */
export const useAgendaRange = (params: {
  from: string
  to: string
  period: AgendaPeriod
  workspaceId?: string
}) =>
  useQuery<Agenda, Error>({
    queryKey: ['agenda', 'range', params],
    queryFn: () => {
      const search = new URLSearchParams({
        from: params.from,
        to: params.to,
        scale: params.period,
      })
      if (params.workspaceId) search.append('workspaceId', params.workspaceId)
      return apiClient.get(`/agenda?${search.toString()}`)
    },
    enabled: Boolean(params.workspaceId),
  })
