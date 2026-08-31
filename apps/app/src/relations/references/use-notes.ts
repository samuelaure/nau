'use client'

/**
 * Confirmed by `module:references` on nau#124: `GET /references/notes` returns
 * a bare `Block<NoteProperties>[]` (no `{ notes, total }` envelope), and there
 * is no `ReferencesReadService`/`toNoteView` flattening step the way
 * `journal-read.service.ts` has for `journal.entry` — the substance/content
 * split from `substrate.contract.ts` is passed through as-is. `title`,
 * `content`, `attachments`, `suggestedType` live under `properties`, not
 * flattened onto the block, unlike this hook's first draft assumed by analogy
 * with Journal.
 *
 * References offered to build a flattening service instead; consuming the raw
 * envelope was chosen here to avoid new API surface for a shape `app` can
 * already destructure cheaply at the call site.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'

export type AttachmentKind = 'image' | 'video' | 'file' | 'link'

export interface Attachment {
  kind: AttachmentKind
  url: string
  metadata: Record<string, unknown> | null
}

export interface NoteProperties {
  title: string | null
  content: string
  attachments: Attachment[]
  /** Set by GTD's triage while a note sits in a tray. Null once ordered or never suggested. */
  suggestedType: string | null
}

/** A `references.note` block, as returned raw by the substrate — see file header. */
export interface Note {
  id: string
  uuid: string
  kind: 'references.note'
  properties: NoteProperties
  workspaceId: string
  userId: string | null
  parentId: string | null
  source: string | null
  sourceRef: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateNoteInput {
  title?: string | null
  content?: string
  attachments?: Attachment[]
  parentId?: string | null
  workspaceId?: string
}

export interface UpdateNoteInput {
  title?: string | null
  content?: string
  attachments?: Attachment[]
}

export const useGetNotes = (params: {
  workspaceId: string | null
  parentId?: string
  take?: number
  skip?: number
}) =>
  useQuery<Note[]>({
    queryKey: ['references', 'notes', params],
    queryFn: () => {
      const search = new URLSearchParams({ workspaceId: params.workspaceId! })
      if (params.parentId) search.set('parentId', params.parentId)
      if (params.take) search.set('take', String(params.take))
      if (params.skip) search.set('skip', String(params.skip))
      return apiClient.get(`/references/notes?${search.toString()}`)
    },
    enabled: !!params.workspaceId,
  })

export const useGetNote = (id: string, workspaceId: string | null) =>
  useQuery<Note>({
    queryKey: ['references', 'notes', id, workspaceId],
    queryFn: () => apiClient.get(`/references/notes/${id}?workspaceId=${workspaceId}`),
    enabled: !!workspaceId,
  })

export const useCreateNote = () => {
  const qc = useQueryClient()
  return useMutation<Note, Error, CreateNoteInput>({
    mutationFn: (body) => apiClient.post('/references/notes', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['references', 'notes'] }),
  })
}

export const useUpdateNote = (workspaceId: string | null) => {
  const qc = useQueryClient()
  return useMutation<Note, Error, { id: string; body: UpdateNoteInput }>({
    mutationFn: ({ id, body }) =>
      apiClient.patch(`/references/notes/${id}?workspaceId=${workspaceId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['references', 'notes'] }),
  })
}

export const useDeleteNote = (workspaceId: string | null) => {
  const qc = useQueryClient()
  return useMutation<{ success: true }, Error, string>({
    mutationFn: (id) => apiClient.delete(`/references/notes/${id}?workspaceId=${workspaceId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['references', 'notes'] }),
  })
}
