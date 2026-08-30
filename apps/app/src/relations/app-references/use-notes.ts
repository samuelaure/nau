'use client'

/**
 * DRAFT, not yet confirmed by `module:references`.
 *
 * Written against the real, merged (local `main`, not yet pushed as of
 * writing) `apps/api/src/relations/api-references/references.controller.ts`
 * — not invented. Every field below is read directly off that controller and
 * `packages/references/src/core/schemas.ts`'s `NoteSchema`/`AttachmentSchema`,
 * per the method in nau#119: draft from observable evidence, mark it
 * unconfirmed in the code itself, publish the issue, converge when the owning
 * session responds.
 *
 * What's genuinely uncertain, flagged rather than guessed:
 * - The exact response envelope of `GET /references/notes` (a bare array? a
 *   `{ notes, total }` page shape? — the controller returns whatever
 *   `references.listNotes()` resolves to, and that return type wasn't
 *   re-derived here without reading the service body, which this draft
 *   didn't do).
 * - Whether `id`/`createdAt`/`updatedAt`/`parentId` are echoed on every
 *   response the same way `journal.entry`'s route does, since `NoteSchema`
 *   only describes `properties`, not the substrate envelope around it.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/http/client'

export type AttachmentKind = 'image' | 'video' | 'file' | 'link'

export interface Attachment {
  kind: AttachmentKind
  url: string
  metadata: Record<string, unknown> | null
}

/** DRAFT: substrate envelope fields assumed by analogy with journal.entry — unconfirmed. */
export interface Note {
  id: string
  kind: 'references.note'
  title: string | null
  content: string
  attachments: Attachment[]
  /** Set by GTD's triage while a note sits in a tray. Null once ordered or never suggested. */
  suggestedType: string | null
  parentId: string | null
  createdAt: string
  updatedAt: string
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
