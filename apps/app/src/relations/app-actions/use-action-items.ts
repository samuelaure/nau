'use client'

/**
 * DRAFT, not yet confirmed by `module:actions`. ENTIRELY SPECULATIVE.
 *
 * Unlike `app-references`' and `app-gtd`'s drafts, there is no real
 * controller to read this off: `apps/api/src/relations/api-actions/` only
 * exposes `agenda.controller.ts` (occurrences — what's owed) and no CRUD
 * route for the `actions.item` kind itself (text, tree, editing). This is
 * exactly the gap #64 and #93 already named: `Dashboard.tsx` still joins
 * `/agenda` occurrences against action blocks fetched from the old,
 * polymorphic `/blocks` because nothing else exists yet.
 *
 * The shape below is derived from the real, registered kind
 * (`packages/actions/src/schemas.ts`'s `ActionItemSchema`) — not invented —
 * but the routes themselves (`/actions/items*`) are a guess at what a REST
 * surface over that kind would look like, shaped by analogy with
 * `references/notes`. `api`'s own comment in nau#76 suggested
 * `/v1/actions/actions` with the tree included in one response, which this
 * draft does not attempt — building tree-shaped pagination without a real
 * endpoint to check it against would be guessing twice.
 *
 * Per nau#119: draft, mark unconfirmed, publish, converge. This one carries
 * the least confidence of the three drafts and says so.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'

export type ActionStatus = 'todo' | 'done' | 'cancelled'
export type ActionPriority = 'low' | 'medium' | 'high'

/** DRAFT: substrate envelope fields assumed by analogy, unconfirmed — see file header. */
export interface ActionItem {
  id: string
  kind: 'actions.item'
  text: string
  status: ActionStatus
  priority: ActionPriority | null
  deadline: string | null
  estimateMinutes: number | null
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateActionItemInput {
  text?: string
  priority?: ActionPriority | null
  deadline?: string | null
  estimateMinutes?: number | null
  parentId?: string | null
  workspaceId?: string
}

export interface UpdateActionItemInput {
  text?: string
  status?: ActionStatus
  priority?: ActionPriority | null
  deadline?: string | null
  estimateMinutes?: number | null
  parentId?: string | null
}

/**
 * SPECULATIVE — `GET /actions/items` does not exist. Kept `enabled: false`
 * so nothing accidentally fires against a 404 in the meantime; flip once
 * `module:actions` confirms a route (or a different shape entirely — the
 * tree-in-one-response alternative `api` floated in nau#76 would replace
 * this hook, not extend it).
 */
export const useGetActionItems = (params: { workspaceId: string | null }) =>
  useQuery<ActionItem[]>({
    queryKey: ['actions', 'items', params.workspaceId],
    queryFn: () => apiClient.get(`/actions/items?workspaceId=${params.workspaceId}`),
    enabled: false,
  })

export const useCreateActionItem = () => {
  const qc = useQueryClient()
  return useMutation<ActionItem, Error, CreateActionItemInput>({
    mutationFn: (body) => apiClient.post('/actions/items', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions', 'items'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

export const useUpdateActionItem = () => {
  const qc = useQueryClient()
  return useMutation<ActionItem, Error, { id: string; body: UpdateActionItemInput }>({
    mutationFn: ({ id, body }) => apiClient.patch(`/actions/items/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions', 'items'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

export const useDeleteActionItem = () => {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete(`/actions/items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions', 'items'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}
