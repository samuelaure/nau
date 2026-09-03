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

interface WorkspaceState {
  /** `null` = all workspaces. */
  activeWorkspaceId: string | null
  setActiveWorkspace: (id: string | null) => void
  /** Pulls in whatever was persisted, once mounted client-side. See the comment below for why this can't happen at store-creation time. */
  hydrateFromStorage: () => void
}

/**
 * Always starts at `null` ("all workspaces") — even in the browser, even if
 * `localStorage` holds a real selection. Reading `localStorage` inside
 * `create()`'s initializer runs at module-evaluation time, which on the
 * very first client render happens *before* React reconciles against the
 * server's markup: a returning visitor with a workspace picked would
 * render its name on the client (e.g. the sidebar's workspace picker text)
 * while the server-rendered HTML it's hydrating against always shows "All
 * workspaces" (the server has no `localStorage`) — the same hydration
 * mismatch already hit twice elsewhere (shell-store.ts's notesViewMode/
 * isDarkMode, notes-view-store.ts's groupBy). `AppShell`'s mount effect
 * calls `hydrateFromStorage` instead, which by definition runs after the
 * first paint is already committed and matched, then updates to the
 * persisted workspace the same way any other post-mount state change
 * would — including the refetches that follow from every query keyed on
 * `activeWorkspaceId`, exactly as if the user had just picked it.
 */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: null,
  setActiveWorkspace: (id) => {
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    }
    set({ activeWorkspaceId: id })
  },
  hydrateFromStorage: () => {
    if (typeof window === 'undefined') return
    set({ activeWorkspaceId: localStorage.getItem(STORAGE_KEY) })
  },
}))

/** The active workspace id alone, for the common case of scoping a request. */
export const useActiveWorkspaceId = () => useWorkspaceStore((s) => s.activeWorkspaceId)
