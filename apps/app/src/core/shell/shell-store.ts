import { create } from 'zustand'

/**
 * How the frame around the content is arranged.
 *
 * Only preferences that are true regardless of what is being shown belong
 * here. Anything that depends on the current module's data or its way of
 * presenting time is that module's, not the shell's — the old `ui-store`
 * failed this test by holding `activeView` (now the URL's job) and
 * `searchQuery` (now the search capability's).
 */

const THEME_KEY = 'nau:theme'

function loadTheme(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(THEME_KEY) === 'dark'
}

interface ShellState {
  isSidebarOpen: boolean
  isDarkMode: boolean
  toggleSidebar: () => void
  toggleDarkMode: () => void
}

export const useShellStore = create<ShellState>((set) => ({
  isSidebarOpen: true,
  // Read at creation so a reload keeps the chosen theme. The class is applied
  // by the shell on mount rather than here, since a store should not be
  // reaching into the document as a side effect of being constructed.
  isDarkMode: loadTheme(),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  toggleDarkMode: () =>
    set((state) => {
      const isDarkMode = !state.isDarkMode
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light')
        document.documentElement.classList.toggle('dark', isDarkMode)
      }
      return { isDarkMode }
    }),
}))
