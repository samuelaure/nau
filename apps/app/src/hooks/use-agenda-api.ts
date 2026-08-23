import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export type AgendaPeriod = 'daily' | 'weekly' | 'monthly'

export interface AgendaItem {
  blockId: string
  type: string
  title: string
  /** The instant the schedule predicted. Completion is recorded against this. */
  occurrenceAt: string
  effectiveAt: string
  moved: boolean
  /** Due at some point inside the period rather than at a moment in it. */
  spansPeriod: boolean
  recurring: boolean
  done: boolean
  sortOrder: number
  estimateMinutes: number | null
  priority: string | null
}

export interface Agenda {
  period: AgendaPeriod
  label: string
  start: string
  end: string
  timezone: string
  items: AgendaItem[]
  /** Minutes still to do. Finished work does not make a day look busier. */
  plannedMinutes: number
  unestimatedCount: number
}

export const useAgenda = (params: { date: string; period: AgendaPeriod; workspaceId?: string }) =>
  useQuery<Agenda, Error>({
    queryKey: ['agenda', params],
    queryFn: () => {
      const search = new URLSearchParams({ date: params.date, period: params.period })
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
