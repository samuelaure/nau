'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'
import type { Workspace, WorkspaceMember, WorkspaceRole } from '@9nau/types'

/**
 * Workspaces and who belongs to them.
 *
 * This is core rather than a module's concern: a workspace is the tenancy
 * every module's data hangs off, and it exists whether or not any module is
 * switched on. Membership is the same question — who may see this tenant —
 * so it lives here too.
 *
 * What was in the old `use-workspaces-api.ts` and is deliberately not here:
 * Brands (Content's concept, removed from the app entirely — see the
 * Content/Brand removal issue) and Projects (Actions' concept, which moves to
 * `relations/app-actions/` with the rest of that module's data hooks).
 */

export type WorkspaceWithRole = Workspace & { role: WorkspaceRole }
export type { Workspace, WorkspaceMember }

export const useGetWorkspaces = () =>
  useQuery<WorkspaceWithRole[]>({
    queryKey: ['workspaces'],
    queryFn: () => apiClient.get('/workspaces'),
  })

export const useCreateWorkspace = () => {
  const qc = useQueryClient()
  return useMutation<Workspace, Error, { name: string }>({
    mutationFn: (body) => apiClient.post('/workspaces', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export const useRenameWorkspace = (workspaceId: string) => {
  const qc = useQueryClient()
  return useMutation<Workspace, Error, { name: string }>({
    mutationFn: (body) => apiClient.patch(`/workspaces/${workspaceId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export const useDeleteWorkspace = (workspaceId: string) => {
  const qc = useQueryClient()
  return useMutation<void, Error>({
    mutationFn: () => apiClient.delete(`/workspaces/${workspaceId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export const useGetMembers = (workspaceId: string | null) =>
  useQuery<WorkspaceMember[]>({
    queryKey: ['members', workspaceId],
    queryFn: () => apiClient.get(`/workspaces/${workspaceId}/members`),
    enabled: !!workspaceId,
  })

export const useAddMember = (workspaceId: string) => {
  const qc = useQueryClient()
  return useMutation<WorkspaceMember, Error, { email: string; role?: string }>({
    mutationFn: (body) => apiClient.post(`/workspaces/${workspaceId}/members`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', workspaceId] }),
  })
}

export const useRemoveMember = (workspaceId: string) => {
  const qc = useQueryClient()
  return useMutation<void, Error, { userId: string }>({
    mutationFn: ({ userId }) => apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', workspaceId] }),
  })
}
