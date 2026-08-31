'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'
import type { Scale, Capabilities, SystemConfig, SystemId } from '@nau/time'

/**
 * Time's HTTP surface, as `app` sees it.
 *
 * `@nau/time` gives the vocabulary (`Scale`, `Capabilities`, `Period`) and
 * the pure logic that needs no server — this file is only the thin part on
 * top: asking `/time/*` for what a workspace has and what it means.
 *
 * `(Time)·Actions` and `(Time)·Journal` are not spoken here. This relation
 * only knows Time; a module that consumes a period to mean something (owed,
 * written) speaks that meaning in its own relation, never in this one.
 */

export interface WorkspaceTimeSystem {
  id: SystemId
  name: string
  enabled: boolean
  config: SystemConfig
  capabilities: Capabilities
  scales: Scale[]
}

export const useTimeSystems = (workspaceId: string | null) =>
  useQuery<{ systems: WorkspaceTimeSystem[] }>({
    queryKey: ['time', 'systems', workspaceId],
    queryFn: () => apiClient.get(`/time/systems?workspaceId=${workspaceId}`),
    enabled: !!workspaceId,
  })

export const useUpdateTimeSystem = (workspaceId: string | null) => {
  const qc = useQueryClient()
  return useMutation<
    { system: string; config: SystemConfig; reindexed: number },
    Error,
    { system: SystemId; config: SystemConfig }
  >({
    mutationFn: ({ system, config }) =>
      apiClient.patch(`/time/systems/${system}`, { workspaceId, config }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time', 'systems', workspaceId] }),
  })
}
