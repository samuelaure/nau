'use client'

/**
 * Confirmed against the real route — `apps/api/src/actions/
 * actions.controller.ts` + `actions.service.ts` (nau#126). The route this
 * file already guessed (`/actions/items*`) turned out correct: `api`'s
 * comment on nau#76 floated `/v1/actions/actions`, but no relation ever
 * shipped with a `v1` prefix (`agenda`, `references/notes`, `journal` are
 * all unprefixed), so the shipped route follows what actually exists.
 *
 * Two real differences from this file's earlier draft, both from reading the
 * real response shape rather than assuming one:
 *
 *   - the substrate's `Block<T>` never flattens `properties` onto the row —
 *     `text`/`status`/`priority`/`deadline`/`estimateMinutes` live under
 *     `properties`, `id`/`uuid`/`kind`/`parentId`/timestamps sit alongside it.
 *   - `hasChildren` is real and returned by every endpoint (`create`, `get`,
 *     `list`, `update`) — the one half of `@nau/actions`' `shapeOf` this
 *     substrate-only CRUD can answer honestly. `Shape` itself (action/habit/
 *     project/routine) still needs `Planning`, which lives in the agenda
 *     (nau#64, not yet migrated) — a caller with both can derive it; this
 *     hook alone cannot and does not pretend to.
 *
 * `GET /actions/items` returns every item in the workspace in one response,
 * regardless of tree depth — `parentId` on each row is what lets a caller
 * reconstruct the tree or render flat and use `hasChildren` to decide what
 * expands. Never paginated: an unbounded personal action list was judged
 * cheap enough not to need it, same call `references/notes` made differently
 * only because a note collection can be much larger.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'

export type ActionStatus = 'todo' | 'done' | 'cancelled'
export type ActionPriority = 'low' | 'medium' | 'high'

export interface ActionItemProperties {
  text: string
  status: ActionStatus
  priority: ActionPriority | null
  deadline: string | null
  estimateMinutes: number | null
  /**
   * Stamped by the substrate on every kind, not declared by Actions' own
   * schema — survives onto the wire only because the schema is
   * `.passthrough()` (packages/actions/src/schemas.ts). Declared here so
   * sibling ordering (buildHierarchy) can read it without a cast.
   */
  sortOrder?: number
}

export interface ActionItem {
  id: string
  uuid: string
  kind: 'actions.item'
  properties: ActionItemProperties
  parentId: string | null
  /** Whether this item has children — derived by the server from the tree, never stored. */
  hasChildren: boolean
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

export const useGetActionItems = (params: { workspaceId: string | null; status?: ActionStatus }) =>
  useQuery<ActionItem[]>({
    queryKey: ['actions', 'items', params.workspaceId, params.status],
    queryFn: () => {
      // `null` means "the workspace on my token" — the server resolves it
      // from the auth context when the param is absent. Gating this query on
      // workspaceId ever being non-null left the dashboard permanently empty
      // for anyone who never opened the workspace switcher.
      const search = new URLSearchParams()
      if (params.workspaceId) search.set('workspaceId', params.workspaceId)
      if (params.status) search.set('status', params.status)
      return apiClient.get(`/actions/items?${search.toString()}`)
    },
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
