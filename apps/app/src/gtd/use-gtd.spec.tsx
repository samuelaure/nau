import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCapture, useTrayContents, ROOT_TRAY_ID } from './use-gtd'
import { apiClient } from '@/core/http/client'

jest.mock('@/core/http/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}))

const apiClientMock = apiClient as jest.Mocked<typeof apiClient>

const queryClient = new QueryClient()
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('use-gtd', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queryClient.clear()
  })

  it('ROOT_TRAY_ID is the fixed convention for naŭ root\'s general tray', () => {
    expect(ROOT_TRAY_ID).toBe('root')
  })

  describe('useCapture', () => {
    it('posts to /gtd/capture with the given input', async () => {
      apiClientMock.post.mockResolvedValue({ blockId: 'b1', trayId: ROOT_TRAY_ID })
      const { result } = renderHook(() => useCapture(), { wrapper })
      result.current.mutate({ trayId: ROOT_TRAY_ID, content: 'hi', title: null, workspaceId: 'ws-1' })
      await waitFor(() => expect(apiClientMock.post).toHaveBeenCalled())
      expect(apiClientMock.post).toHaveBeenCalledWith('/gtd/capture', {
        trayId: ROOT_TRAY_ID,
        content: 'hi',
        title: null,
        workspaceId: 'ws-1',
      })
    })

    it('invalidates both gtd and references/notes queries on success — capture always creates a references.note under the hood', async () => {
      apiClientMock.post.mockResolvedValue({ blockId: 'b1', trayId: ROOT_TRAY_ID })
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const { result } = renderHook(() => useCapture(), { wrapper })
      result.current.mutate({ trayId: ROOT_TRAY_ID })
      await waitFor(() => expect(apiClientMock.post).toHaveBeenCalled())
      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gtd'] })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['references', 'notes'] })
      })
    })
  })

  describe('useTrayContents', () => {
    it('fetches /gtd/tray with trayId and workspaceId when a workspace is selected', async () => {
      apiClientMock.get.mockResolvedValue({ trayId: ROOT_TRAY_ID, blockIds: ['b1', 'b2'] })
      const { result } = renderHook(() => useTrayContents({ trayId: ROOT_TRAY_ID, workspaceId: 'ws-1' }), { wrapper })
      await waitFor(() => expect(result.current.data).toBeDefined())
      expect(apiClientMock.get).toHaveBeenCalledWith('/gtd/tray?trayId=root&workspaceId=ws-1')
      expect(result.current.data).toEqual({ trayId: ROOT_TRAY_ID, blockIds: ['b1', 'b2'] })
    })

    // Same bug class fixed across use-notes.ts (nau#145's frontend half) —
    // null must never be interpolated into the query string as the literal
    // string "null", which the server would read as a real workspace id.
    it('omits workspaceId from the query string when null, never interpolates the literal "null"', async () => {
      apiClientMock.get.mockResolvedValue({ trayId: ROOT_TRAY_ID, blockIds: [] })
      renderHook(() => useTrayContents({ trayId: ROOT_TRAY_ID, workspaceId: null }), { wrapper })
      await waitFor(() => expect(apiClientMock.get).toHaveBeenCalled())
      const [url] = apiClientMock.get.mock.calls[0]
      expect(url).toBe('/gtd/tray?trayId=root')
      expect(url).not.toMatch(/null/)
    })
  })
})
