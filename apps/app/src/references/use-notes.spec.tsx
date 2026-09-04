import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetNotes, useGetNote, useUpdateNote, useDeleteNote, useCreateNote } from './use-notes'
import { apiClient } from '@/core/http/client'

jest.mock('@/core/http/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}))

const apiClientMock = apiClient as jest.Mocked<typeof apiClient>

const queryClient = new QueryClient()
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

/**
 * `workspaceId: null` means "use my token's workspace" — a real, valid
 * selection (see workspace-store.ts), not an absence. Every one of these
 * hooks used to interpolate it into the URL unconditionally, producing the
 * literal string "null" the server reads as a real (nonexistent) workspace
 * id and 403s on — silently breaking edit/delete for anyone who hadn't
 * explicitly picked a workspace. Fixed by omitting the param entirely when
 * falsy; these specs are the regression guard that bug never had before.
 */
describe('use-notes — workspaceId omission when null', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    apiClientMock.get.mockResolvedValue([])
    apiClientMock.patch.mockResolvedValue({})
    apiClientMock.delete.mockResolvedValue({ success: true })
    apiClientMock.post.mockResolvedValue({})
    queryClient.clear()
  })

  it('useGetNotes omits workspaceId from the query string when null', async () => {
    renderHook(() => useGetNotes({ workspaceId: null }), { wrapper })
    await waitFor(() => expect(apiClientMock.get).toHaveBeenCalled())
    const [url] = apiClientMock.get.mock.calls[0]
    expect(url).not.toMatch(/workspaceId/)
  })

  it('useGetNotes includes workspaceId when a real one is selected', async () => {
    renderHook(() => useGetNotes({ workspaceId: 'ws-1' }), { wrapper })
    await waitFor(() => expect(apiClientMock.get).toHaveBeenCalled())
    const [url] = apiClientMock.get.mock.calls[0]
    expect(url).toMatch(/workspaceId=ws-1/)
  })

  it('useGetNote omits workspaceId when null, never interpolates the literal "null"', async () => {
    apiClientMock.get.mockResolvedValue({})
    renderHook(() => useGetNote('note-1', null), { wrapper })
    await waitFor(() => expect(apiClientMock.get).toHaveBeenCalled())
    const [url] = apiClientMock.get.mock.calls[0]
    expect(url).toBe('/references/notes/note-1')
    expect(url).not.toMatch(/null/)
  })

  it('useUpdateNote omits workspaceId when null, never interpolates the literal "null"', async () => {
    const { result } = renderHook(() => useUpdateNote(null), { wrapper })
    result.current.mutate({ id: 'note-1', body: { content: 'x' } })
    await waitFor(() => expect(apiClientMock.patch).toHaveBeenCalled())
    const [url] = apiClientMock.patch.mock.calls[0]
    expect(url).toBe('/references/notes/note-1')
    expect(url).not.toMatch(/null/)
  })

  it('useUpdateNote includes workspaceId when a real one is selected', async () => {
    const { result } = renderHook(() => useUpdateNote('ws-1'), { wrapper })
    result.current.mutate({ id: 'note-1', body: { content: 'x' } })
    await waitFor(() => expect(apiClientMock.patch).toHaveBeenCalled())
    const [url] = apiClientMock.patch.mock.calls[0]
    expect(url).toBe('/references/notes/note-1?workspaceId=ws-1')
  })

  it('useDeleteNote omits workspaceId when null, never interpolates the literal "null"', async () => {
    const { result } = renderHook(() => useDeleteNote(null), { wrapper })
    result.current.mutate('note-1')
    await waitFor(() => expect(apiClientMock.delete).toHaveBeenCalled())
    const [url] = apiClientMock.delete.mock.calls[0]
    expect(url).toBe('/references/notes/note-1')
    expect(url).not.toMatch(/null/)
  })

  it('useDeleteNote includes workspaceId when a real one is selected', async () => {
    const { result } = renderHook(() => useDeleteNote('ws-1'), { wrapper })
    result.current.mutate('note-1')
    await waitFor(() => expect(apiClientMock.delete).toHaveBeenCalled())
    const [url] = apiClientMock.delete.mock.calls[0]
    expect(url).toBe('/references/notes/note-1?workspaceId=ws-1')
  })

  it('useCreateNote posts to the notes endpoint with the given workspaceId', async () => {
    const { result } = renderHook(() => useCreateNote(), { wrapper })
    result.current.mutate({ content: 'hi', title: null, workspaceId: 'ws-1' })
    await waitFor(() => expect(apiClientMock.post).toHaveBeenCalled())
    expect(apiClientMock.post).toHaveBeenCalledWith('/references/notes', { content: 'hi', title: null, workspaceId: 'ws-1' })
  })
})
