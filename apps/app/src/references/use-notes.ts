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
  /**
   * Stamped by the substrate on every kind, not declared by References' own
   * schema — survives onto the wire only because the schema is
   * `.passthrough()` (packages/references/src/core/schemas.ts).
   */
  sortOrder?: number
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
      const search = new URLSearchParams()
      // `null` means "the workspace on my token" — the server already
      // resolves it from the auth context when the param is absent
      // (references.controller.ts: `body.workspaceId ?? user.workspaceId`).
      // Gating the query on this ever being non-null left every screen
      // permanently empty for a person who never opened the workspace
      // switcher, since nothing else sets it by default.
      if (params.workspaceId) search.set('workspaceId', params.workspaceId)
      if (params.parentId) search.set('parentId', params.parentId)
      if (params.take) search.set('take', String(params.take))
      if (params.skip) search.set('skip', String(params.skip))
      return apiClient.get(`/references/notes?${search.toString()}`)
    },
  })

export const useGetNote = (id: string, workspaceId: string | null) =>
  useQuery<Note>({
    queryKey: ['references', 'notes', id, workspaceId],
    // Same reasoning as useGetNotes: null is a real, valid "use my token's
    // workspace" selection, not a not-yet-loaded value, so it must not be
    // interpolated into the query string as the literal string "null", and
    // must not gate the query behind `enabled` either.
    queryFn: () => apiClient.get(`/references/notes/${id}${workspaceId ? `?workspaceId=${workspaceId}` : ''}`),
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
    mutationFn: ({ id, body }) => {
      // `null` means "the workspace on my token" — same as useGetNotes above.
      // This used to interpolate the literal string "null" into the query
      // string whenever no workspace was explicitly selected, which the
      // server reads as a real (nonexistent) workspace id and 403s on —
      // silently breaking every edit for anyone who hadn't picked a
      // workspace, the same shape of bug as nau's other workspaceId-gated
      // query fixes.
      const search = workspaceId ? `?workspaceId=${workspaceId}` : ''
      return apiClient.patch(`/references/notes/${id}${search}`, body)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['references', 'notes'] }),
  })
}

export const useDeleteNote = (workspaceId: string | null) => {
  const qc = useQueryClient()
  return useMutation<{ success: true }, Error, string>({
    mutationFn: (id) => {
      // Same reasoning as useUpdateNote above.
      const search = workspaceId ? `?workspaceId=${workspaceId}` : ''
      return apiClient.delete(`/references/notes/${id}${search}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['references', 'notes'] }),
  })
}
