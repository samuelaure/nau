'use client'

/**
 * Confirmed against `apps/api/src/gtd/gtd.controller.ts`/`gtd.service.ts`.
 * `useCapture`, `useProcess`, `useOrder` were already confirmed; nau#125
 * resolved the one open gap — `useTrayContents` now calls the real
 * `GET /gtd/tray?trayId&workspaceId → { trayId, blockIds: string[] }`,
 * closed and verified (25 tests, nau#125's own comment thread) rather than
 * speculative.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'

/**
 * The general tray of naŭ itself — the root block, per the recursive model
 * every block's own General/Actions/References/Journal/Ideas set follows
 * (tmp/flows/gtd_ui_ux_flows.md §0). `trayId` is an opaque string owned by
 * whichever caller creates it (packages/gtd/src/core/tray.ts is explicit
 * that the core never names one) — naŭ root has no real `Block` row of its
 * own to derive an id from, so this is the fixed convention for it, decided
 * 2026-09-04. A tray inside some other block would use that block's own id,
 * not this constant.
 */
export const ROOT_TRAY_ID = 'root'

export interface CaptureInput {
  trayId: string
  content?: string
  title?: string | null
  workspaceId?: string
}

export const useCapture = () => {
  const qc = useQueryClient()
  return useMutation<{ blockId: string; trayId: string }, Error, CaptureInput>({
    mutationFn: (body) => apiClient.post('/gtd/capture', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gtd'] })
      // capture always creates a references.note under the hood
      // (gtd.service.ts) — the caller that hydrates a tray's blockIds
      // against References' own list (BandejaGeneral's approach) needs
      // that list refreshed too, or a just-captured note won't appear
      // until something else happens to invalidate it.
      qc.invalidateQueries({ queryKey: ['references', 'notes'] })
    },
  })
}

export const useProcess = () => {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { blockId: string; toTrayId: string }>({
    mutationFn: ({ blockId, toTrayId }) => apiClient.post(`/gtd/${blockId}/process`, { toTrayId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gtd'] }),
  })
}

export type OrderDestination = 'actions' | 'journal' | 'references'

/**
 * The destination-specific fields are each relation's own contract
 * (`OrderIntoActions`/`OrderIntoJournal`/`OrderIntoReferences` in
 * `gtd.controller.ts`), flattened here into one optional bag rather than a
 * discriminated union — matches the server's own `OrderBody` shape, which
 * does the same thing keyed by `destination`.
 */
export interface OrderInput {
  blockId: string
  destination: OrderDestination
  workspaceId?: string
  text?: string
  priority?: 'low' | 'medium' | 'high' | null
  deadline?: string | null
  capturedAt?: string
  source?: string
  originFormat?: string
}

export const useOrder = () => {
  const qc = useQueryClient()
  return useMutation<unknown, Error, OrderInput>({
    mutationFn: (body) => apiClient.post('/gtd/order', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gtd'] })
      // The destination module's own lists change too — ordering a note into
      // Actions or Journal is a write those relations' own caches don't know
      // about unless told. Broad invalidation until per-destination cache
      // keys are confirmed with each relation.
      qc.invalidateQueries({ queryKey: ['references', 'notes'] })
      qc.invalidateQueries({ queryKey: ['journal'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

/** Confirmed: one item's current tray membership and whether it's been ordered. */
export const useItemTray = (blockId: string | null) =>
  useQuery<{ blockId: string; trayId: string | null; ordered: boolean }>({
    queryKey: ['gtd', 'tray', blockId],
    queryFn: () => apiClient.get(`/gtd/${blockId}/tray`),
    enabled: !!blockId,
  })

/**
 * Every block currently sitting in one tray — ids only, not hydrated
 * (nau#125's own answer: the route deliberately returns ids, not full
 * blocks, keeping the substance/content split the rest of the design
 * follows; hydrating them against each destination's own list is the
 * caller's job — see BandejaGeneral's use of this, which filters an
 * already-fetched References list rather than adding a second fetch).
 *
 * `workspaceId: null` means "the workspace on my token" — same convention
 * as every other hook here; the param is omitted rather than interpolated
 * as the literal string "null" (the bug class fixed across use-notes.ts).
 */
export const useTrayContents = (params: { trayId: string; workspaceId: string | null }) =>
  useQuery<{ trayId: string; blockIds: string[] }>({
    queryKey: ['gtd', 'tray-contents', params.trayId, params.workspaceId],
    queryFn: () => {
      const search = new URLSearchParams({ trayId: params.trayId })
      if (params.workspaceId) search.set('workspaceId', params.workspaceId)
      return apiClient.get(`/gtd/tray?${search.toString()}`)
    },
  })
