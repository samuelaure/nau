import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export type RecurrenceMode = 'FIXED' | 'AFTER_COMPLETION'

export interface UpsertScheduleInput {
  blockId: string
  /** ISO instant. For a range, the start of it. */
  startDate: string
  /** ISO instant. Equal to startDate for a single day; the end of the period otherwise. */
  endDate?: string | null
  /** RFC 5545 rule, without the RRULE: prefix. Null for a one-off. */
  rrule?: string | null
  recurrenceMode?: RecurrenceMode
}

/**
 * Sets when a block is meant to happen.
 *
 * This is the only thing that makes a block appear on the agenda. Before it, a
 * task exists but is due nowhere.
 */
export const useUpsertSchedule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertScheduleInput) => apiClient.post('/schedule', input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
    },
  })
}

export const useRemoveSchedule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scheduleId: string) => apiClient.delete(`/schedule/${scheduleId}`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
    },
  })
}
