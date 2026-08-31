'use client'

/**
 * Domain hooks for Journal entries and syntheses.
 *
 * Replaces the generic `use-blocks-api` hooks that `JournalView.tsx` used to
 * reach `/blocks?type=journal_entry`. Each hook maps to a specific route on
 * the journal module's read controller (nau#134).
 *
 * Shape note: read routes return a `JournalEntryView` / `JournalSynthesisView`
 * (fields flattened by the service, unlike References which passes raw Block
 * envelopes). The write routes return the same flattened view so the cache can
 * be updated in place without a refetch.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'

// ── Read types ────────────────────────────────────────────────────────────────

export interface JournalEntryView {
  id: string
  kind: 'journal.entry'
  text: string
  /** When it was lived, not when ingestion finished. ISO 8601. */
  date: string
  source: string
  originFormat: string
  editedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface JournalSynthesisView {
  id: string
  kind: 'journal.synthesis'
  synthesis: string | null
  reflection: string | null
  from: string
  to: string
  /** True when the period held nothing to record. */
  noData: boolean
  createdAt: string
  updatedAt: string
}

// ── Query key factory ─────────────────────────────────────────────────────────

const JOURNAL_KEYS = {
  entries: (params: object) => ['journal', 'entries', params] as const,
  syntheses: (params: object) => ['journal', 'syntheses', params] as const,
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export const useGetJournalEntries = (params: {
  workspaceId: string | null
  from?: string
  to?: string
  limit?: number
}) =>
  useQuery<JournalEntryView[]>({
    queryKey: JOURNAL_KEYS.entries(params),
    queryFn: () => {
      // `null` means "the workspace on my token" — the server resolves it
      // from the auth context when the param is absent. Gating this query on
      // workspaceId ever being non-null left Journal permanently empty for
      // anyone who never opened the workspace switcher.
      const s = new URLSearchParams()
      if (params.workspaceId) s.set('workspaceId', params.workspaceId)
      if (params.from) s.set('from', params.from)
      if (params.to) s.set('to', params.to)
      if (params.limit) s.set('limit', String(params.limit))
      return apiClient.get(`/journal/entries?${s.toString()}`)
    },
  })

export const useGetJournalSyntheses = (params: {
  workspaceId: string | null
  from?: string
  to?: string
  limit?: number
}) =>
  useQuery<JournalSynthesisView[]>({
    queryKey: JOURNAL_KEYS.syntheses(params),
    queryFn: () => {
      const s = new URLSearchParams()
      if (params.workspaceId) s.set('workspaceId', params.workspaceId)
      if (params.from) s.set('from', params.from)
      if (params.to) s.set('to', params.to)
      if (params.limit) s.set('limit', String(params.limit))
      return apiClient.get(`/journal/syntheses?${s.toString()}`)
    },
  })

// ── Writes (entry) ────────────────────────────────────────────────────────────

export const useCreateJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation<JournalEntryView, Error, { text: string; date?: string; workspaceId?: string }>({
    mutationFn: (body) => apiClient.post('/journal/entries', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', 'entries'] }),
  })
}

export const useUpdateJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation<JournalEntryView, Error, { id: string; text: string; workspaceId?: string }>({
    mutationFn: ({ id, text, workspaceId }) => {
      const qs = workspaceId ? `?workspaceId=${workspaceId}` : ''
      return apiClient.patch(`/journal/entries/${id}${qs}`, { text })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', 'entries'] }),
  })
}

export const useDeleteJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; workspaceId?: string }>({
    mutationFn: ({ id, workspaceId }) => {
      const qs = workspaceId ? `?workspaceId=${workspaceId}` : ''
      return apiClient.delete(`/journal/entries/${id}${qs}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', 'entries'] }),
  })
}

// ── Writes (synthesis) — text only, never regenerates ─────────────────────────

export const useUpdateJournalSynthesis = () => {
  const qc = useQueryClient()
  return useMutation<
    JournalSynthesisView,
    Error,
    { id: string; synthesis?: string; reflection?: string; workspaceId?: string }
  >({
    mutationFn: ({ id, workspaceId, ...body }) => {
      const qs = workspaceId ? `?workspaceId=${workspaceId}` : ''
      return apiClient.patch(`/journal/syntheses/${id}${qs}`, body)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', 'syntheses'] }),
  })
}
