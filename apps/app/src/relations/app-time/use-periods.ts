'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'
import { gregorian, type ScaleId, type SystemId } from '@nau/time'

/**
 * Periods, resolved by the server rather than recomputed in the browser.
 *
 * The frontend used to carry its own copy of "where does a week start" —
 * `lib/periods.ts`, deleted by this relation — kept in sync with the server
 * only by a comment saying the two must agree. They didn't: a workspace whose
 * week began on Sunday created items in one range and saw them in another.
 * `@nau/time` is one implementation now, shared by both, so there is nothing
 * left here to keep in sync.
 */

export interface ResolvedPeriod {
  system: SystemId
  scale: ScaleId
  /** Canonical instant identifying this period. Name it back to the server with this. */
  anchor: string
  /** The system's own name, e.g. "agosto de 2026". Not the user's title. */
  name: string
  from: string
  to: string | null
  /** The person's own name for it, if they gave one. Null otherwise. */
  title: string | null
}

export const usePeriodsIn = (params: {
  scale: ScaleId
  from: string
  to: string
  system?: SystemId
  workspaceId: string | null
}) => {
  const system = params.system ?? gregorian.id
  return useQuery<{ periods: ResolvedPeriod[]; timezone: string }>({
    queryKey: ['time', 'periods', system, params.scale, params.from, params.to, params.workspaceId],
    queryFn: () => {
      const search = new URLSearchParams({
        scale: params.scale,
        from: params.from,
        to: params.to,
        system,
        workspaceId: params.workspaceId!,
      })
      return apiClient.get(`/time/periods?${search.toString()}`)
    },
    enabled: !!params.workspaceId,
  })
}

export const usePeriodAt = (params: {
  scale: ScaleId
  at: string
  system?: SystemId
  workspaceId: string | null
}) => {
  const system = params.system ?? gregorian.id
  return useQuery<{ period: ResolvedPeriod | null; timezone: string }>({
    queryKey: ['time', 'period', system, params.scale, params.at, params.workspaceId],
    queryFn: () => {
      const search = new URLSearchParams({
        scale: params.scale,
        at: params.at,
        system,
        workspaceId: params.workspaceId!,
      })
      return apiClient.get(`/time/period?${search.toString()}`)
    },
    enabled: !!params.workspaceId,
  })
}
