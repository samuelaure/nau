'use client'

/**
 * DRAFT, not yet confirmed by `module:gtd`.
 *
 * Written against the real, merged (local `main`, unpushed as of writing)
 * `apps/api/src/gtd/gtd.controller.ts` and `gtd.service.ts` —
 * not invented. Per nau#119's method: draft from observable evidence, mark
 * it unconfirmed in the code, publish the issue, converge.
 *
 * **The gap this draft cannot fill on its own**: `api-gtd` exposes capture,
 * process, order, and reading ONE item's current tray
 * (`GET /gtd/:blockId/tray`). There is no route that lists everything sitting
 * in a tray — nothing `app`'s Inbox view can page through. `useCapture`,
 * `useProcess` and `useOrder` below are confirmed against real routes.
 * `useTrayContents` is speculative — it assumes a list endpoint that does not
 * exist yet, shaped by analogy with `references.listNotes` and `journal
 * entries`. This is the central question the tracking issue asks GTD to
 * resolve, not a detail to nod through.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'

export interface CaptureInput {
  trayId: string
  content?: string
  title?: string | null
  workspaceId?: string
}

export const useCapture = () => {
  const qc = useQueryClient()
  return useMutation<{ blockId: string }, Error, CaptureInput>({
    mutationFn: (body) => apiClient.post('/gtd/capture', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gtd'] }),
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
 * SPECULATIVE — no confirmed endpoint. Assumes a `GET /gtd/tray` list route
 * shaped like `references.listNotes`, which does not exist in
 * `gtd.controller.ts` today. Do not build UI against this until `module:gtd`
 * confirms the shape (or confirms there is deliberately no such listing —
 * see the draft's opening note).
 */
export const useTrayContents = (params: { trayId: string; workspaceId: string | null }) =>
  useQuery<unknown[]>({
    queryKey: ['gtd', 'tray-contents', params.trayId, params.workspaceId],
    queryFn: () => apiClient.get(`/gtd/tray?trayId=${params.trayId}&workspaceId=${params.workspaceId}`),
    enabled: false, // Never actually fires — the route is speculative, not confirmed.
  })
