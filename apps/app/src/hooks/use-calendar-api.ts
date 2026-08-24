import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useUiStore } from '@/lib/state/ui-store'
import type { CalendarConfig } from '@/lib/periods'

export interface WorkspaceCalendar {
  timezone: string
  config: CalendarConfig
  calendarId: string | null
  kind: string
}

/**
 * How this workspace divides time.
 *
 * Fetched rather than assumed, because the client and the server must agree
 * exactly. If one starts the week on Monday and the other on Sunday, the list
 * draws one week while the summaries describe another and nothing says so.
 */
export const useWorkspaceCalendar = () => {
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)
  return useQuery<WorkspaceCalendar, Error>({
    queryKey: ['calendar', activeWorkspaceId],
    queryFn: () => apiClient.get(`/calendar?workspaceId=${activeWorkspaceId}`),
    enabled: Boolean(activeWorkspaceId),
    staleTime: 5 * 60 * 1000,
  })
}

export const useUpdateCalendar = () => {
  const queryClient = useQueryClient()
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)
  return useMutation({
    mutationFn: (patch: { firstDayOfWeek?: number }) =>
      apiClient.patch('/calendar', { ...patch, workspaceId: activeWorkspaceId }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      // Every period boundary moves with it, so anything grouped by period has
      // to be asked again.
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
    },
  })
}
