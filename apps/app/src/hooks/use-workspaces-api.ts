'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Workspace, WorkspaceMember, WorkspaceRole, Project, CreateProjectDto, UpdateProjectDto } from '@9nau/types'

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

export const useGetProjects = (workspaceId: string | null) =>
  useQuery<Project[]>({
    queryKey: ['projects', workspaceId],
    queryFn: () => apiClient.get(`/workspaces/${workspaceId}/projects`),
    enabled: !!workspaceId,
  })

export const useCreateProject = (workspaceId: string) => {
  const qc = useQueryClient()
  return useMutation<Project, Error, CreateProjectDto>({
    mutationFn: (body) => apiClient.post(`/workspaces/${workspaceId}/projects`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  })
}

export const useUpdateProject = (projectId: string, workspaceId: string) => {
  const qc = useQueryClient()
  return useMutation<Project, Error, UpdateProjectDto>({
    mutationFn: (body) => apiClient.patch(`/projects/${projectId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  })
}

export const useDeleteProject = (workspaceId: string) => {
  const qc = useQueryClient()
  return useMutation<void, Error, { projectId: string }>({
    mutationFn: ({ projectId }) => apiClient.delete(`/projects/${projectId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
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
