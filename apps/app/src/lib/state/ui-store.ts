import { create } from 'zustand'

export type View = 'home' | 'inbox' | 'actions' | 'projects' | 'journal' | 'experiences' | 'information' | 'search' | 'schedule' | 'trash'

const WS_STORAGE_KEY = 'nau:activeWorkspaceId'

function loadWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(WS_STORAGE_KEY)
}

interface UiState {
  isSidebarOpen: boolean
  activeView: View
  isDarkMode: boolean
  searchQuery: string
  activeWorkspaceId: string | null // null = "All workspaces"
  actions: {
    toggleSidebar: () => void
    setView: (view: View) => void
    toggleDarkMode: () => void
    setSearchQuery: (query: string) => void
    setActiveWorkspace: (id: string | null) => void
  }
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: true,
  activeView: 'home',
  isDarkMode: false,
  searchQuery: '',
  activeWorkspaceId: loadWorkspaceId(),
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
    setActiveWorkspace: (id) => {
      if (typeof window !== 'undefined') {
        if (id) localStorage.setItem(WS_STORAGE_KEY, id)
        else localStorage.removeItem(WS_STORAGE_KEY)
      }
      set({ activeWorkspaceId: id })
    },
  },
}))

export const useUiActions = () => useUiStore((state) => state.actions)
