import { create } from 'zustand'

/**
 * Who the app is rendering for.
 *
 * Which workspace is active is not a preference and not a view state — it
 * scopes every request any module makes, so it belongs to identity rather
 * than to the shell. It was previously mixed into `ui-store` alongside the
 * sidebar's open/closed flag and the current view, three unrelated
 * lifetimes in one store.
 *
 * `null` means "all workspaces", which is a real selection and not an
 * absence — the difference matters to callers that scope a query.
 */

const STORAGE_KEY = 'nau:activeWorkspaceId'

function loadPersisted(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

interface WorkspaceState {
  /** `null` = all workspaces. */
  activeWorkspaceId: string | null
  setActiveWorkspace: (id: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: loadPersisted(),
  setActiveWorkspace: (id) => {
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    }
    set({ activeWorkspaceId: id })
  },
}))

/** The active workspace id alone, for the common case of scoping a request. */
export const useActiveWorkspaceId = () => useWorkspaceStore((s) => s.activeWorkspaceId)
