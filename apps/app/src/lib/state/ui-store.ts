import { create } from 'zustand'

export type View = 'home' | 'agenda' | 'inbox' | 'actions' | 'projects' | 'journal' | 'experiences' | 'information' | 'search' | 'schedule' | 'trash'

/**
 * `activeWorkspaceId` used to live here, alongside sidebar/view/darkmode
 * state — three unrelated lifetimes in one store. It moved to
 * `core/identity/workspace-store.ts` (`useActiveWorkspaceId`) because which
 * workspace is active scopes every request any module makes, which makes it
 * identity, not shell state.
 *
 * The move was only ever done in that one file: `sidebar.tsx`'s workspace
 * selector wrote to the new store, but every reader elsewhere in the app
 * (`home/page.tsx`, `Dashboard.tsx`, `note-input.tsx`, and seven more) kept
 * reading this one — a field that existed here but that nothing ever wrote
 * to again after the app booted from `localStorage`. Selecting a workspace
 * in the sidebar silently stopped affecting anything a person could see.
 * Removed here, all ten readers repointed at `useActiveWorkspaceId`.
 */
interface UiState {
  isSidebarOpen: boolean
  activeView: View
  isDarkMode: boolean
  searchQuery: string
  actions: {
    toggleSidebar: () => void
    setView: (view: View) => void
    toggleDarkMode: () => void
    setSearchQuery: (query: string) => void
  }
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: true,
  activeView: 'home',
  isDarkMode: false,
  searchQuery: '',
  actions: {
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setView: (view) => set({ activeView: view }),
    toggleDarkMode: () => set((state) => {
      const newMode = !state.isDarkMode
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', newMode)
      }
      return { isDarkMode: newMode }
    }),
    setSearchQuery: (query) => set({ searchQuery: query }),
  },
}))

export const useUiActions = () => useUiStore((state) => state.actions)
