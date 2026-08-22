import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

/**
 * A summary over a range the person picked themselves — a trip, a stretch of
 * weeks, whatever they consider one period of their life.
 *
 * Separate from the scheduled summaries, which a cron generates on calendar
 * boundaries and which refuse to run twice for the same period. A custom range
 * is regenerated whenever it is asked for, because asking again is the point.
 */
export const useCustomSummary = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { startDate: string; endDate: string; workspaceId?: string }) =>
      apiClient.post<{ success: boolean; blockId?: string; skipped?: boolean; error?: string }>(
        '/journal/summary/custom',
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  })
}
