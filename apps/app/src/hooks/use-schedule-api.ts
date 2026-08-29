import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ScaleId, SystemId } from '@nau/time'

export type RecurrenceMode = 'FIXED' | 'AFTER_COMPLETION'

export interface UpsertPlanningInput {
  blockId: string
  /** Defaults to the workspace's own system server-side when omitted. */
  system?: SystemId
  scale: ScaleId
  /** Canonical instant identifying the period — see `ResolvedPeriod.anchor`. */
  anchor: string
  /** RFC 5545 rule (Gregorian), or whatever the system's own dialect is. Null for a one-off. */
  recurrence?: string | null
  recurrenceTimezone?: string | null
  recurrenceMode?: RecurrenceMode
  recurrenceUntil?: string | null
}

/**
 * Places a block in a period, or moves it to another.
 *
 * `POST /schedule` — this hook's previous target — was confirmed dead in
 * production before this migration (measured: 404, independent of any
 * deploy; see nau#58, nau#93). This is not a rename of working code, it is
 * the fix: `POST /time/planning` is the real endpoint
 * (`apps/api/src/time/time.controller.ts`), against the `Planning` model that
 * replaced the pre-Time `Schedule`.
 *
 * This is the only thing that makes a block appear on the agenda. Before it,
 * an item exists but is due nowhere.
 */
export const useUpsertPlanning = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertPlanningInput) => apiClient.post('/time/planning', input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
      queryClient.invalidateQueries({ queryKey: ['time'] })
    },
  })
}

export const useRemovePlanning = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (planningId: string) => apiClient.delete(`/time/planning/${planningId}`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
      queryClient.invalidateQueries({ queryKey: ['time'] })
    },
  })
}
