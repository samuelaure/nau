import { useWorkspaceStore, useActiveWorkspaceId } from './workspace-store'
import { renderHook } from '@testing-library/react'

describe('workspace-store', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkspaceStore.setState({ activeWorkspaceId: null })
  })

  it('starts at null ("all workspaces" — a real selection, not a not-yet-loaded sentinel)', () => {
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBeNull()
  })

  it('setActiveWorkspace(id) persists it', () => {
    useWorkspaceStore.getState().setActiveWorkspace('ws-1')
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('ws-1')
    expect(localStorage.getItem('nau:activeWorkspaceId')).toBe('ws-1')
  })

  it('setActiveWorkspace(null) clears the persisted value', () => {
    useWorkspaceStore.getState().setActiveWorkspace('ws-1')
    useWorkspaceStore.getState().setActiveWorkspace(null)
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBeNull()
    expect(localStorage.getItem('nau:activeWorkspaceId')).toBeNull()
  })

  it('useActiveWorkspaceId reads the same field', () => {
    useWorkspaceStore.setState({ activeWorkspaceId: 'ws-2' })
    const { result } = renderHook(() => useActiveWorkspaceId())
    expect(result.current).toBe('ws-2')
  })

  describe('hydrateFromStorage', () => {
    it('picks up a stored workspace id', () => {
      localStorage.setItem('nau:activeWorkspaceId', 'ws-3')
      useWorkspaceStore.getState().hydrateFromStorage()
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('ws-3')
    })

    it('stays null when nothing is stored', () => {
      useWorkspaceStore.getState().hydrateFromStorage()
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBeNull()
    })

    it('treats an empty string as absent, same as null', () => {
      localStorage.setItem('nau:activeWorkspaceId', '')
      useWorkspaceStore.getState().hydrateFromStorage()
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBeNull()
    })
  })
})
