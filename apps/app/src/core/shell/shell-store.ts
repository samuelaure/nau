import { create } from 'zustand'
import { readPersisted } from '@/lib/state/persisted-field'

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
const NOTES_VIEW_MODE_KEY = 'nau:notes-view-mode'

type NotesViewMode = 'grid' | 'list'

interface ShellState {
  isSidebarOpen: boolean
  isDarkMode: boolean
  /** Keep's grid/list toggle for the notes tray — a display preference, not tied to any one module's data. */
  notesViewMode: NotesViewMode
  toggleSidebar: () => void
  toggleDarkMode: () => void
  setNotesViewMode: (mode: NotesViewMode) => void
  /** Pulls in whatever was persisted, once mounted client-side. See the comment below for why this can't happen at store-creation time. */
  hydrateFromStorage: () => void
}

/**
 * `isDarkMode` starts `true` here — matching the inline script in
 * `app/layout.tsx`, which applies the `dark` class before first paint using
 * the same rule (dark unless `nau:theme` is explicitly `'light'`). Without
 * that script, starting the store itself at `true` would only move the
 * flash from "briefly light" to "server always light, client always dark",
 * since the server can never read `localStorage` — the script is what
 * actually prevents the flash; this default just keeps the store's first
 * render consistent with what's already on screen by the time React runs.
 *
 * `notesViewMode` has no such script (it doesn't affect first paint the
 * same way — nothing above the fold depends on it) and stays SSR-safe at
 * its light/grid default: reading `localStorage` inside `create()`'s
 * initializer runs at module-evaluation time, before React reconciles
 * against the server's markup, and a mismatch there is a real hydration
 * error (confirmed via the grid/list icon's own `<svg>` failing to match).
 * `hydrateFromStorage`, called from `AppShell`'s mount effect, corrects
 * both fields to their real persisted values after the first paint is
 * already committed and matched.
 */
export const useShellStore = create<ShellState>((set) => ({
  isSidebarOpen: true,
  isDarkMode: true,
  notesViewMode: 'grid',

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

  setNotesViewMode: (mode) =>
    set(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(NOTES_VIEW_MODE_KEY, mode)
      }
      return { notesViewMode: mode }
    }),

  hydrateFromStorage: () => {
    if (typeof window === 'undefined') return
    // Same rule as the inline script in app/layout.tsx: dark unless the
    // visitor explicitly opted into light. Keeping both in sync matters —
    // this store disagreeing with the script would mean the class the
    // script already applied gets flipped back off a moment later.
    const isDarkMode = localStorage.getItem(THEME_KEY) !== 'light'
    const notesViewMode = readPersisted<NotesViewMode>(
      NOTES_VIEW_MODE_KEY,
      (v): v is NotesViewMode => v === 'grid' || v === 'list',
      'grid',
    )
    document.documentElement.classList.toggle('dark', isDarkMode)
    set({ isDarkMode, notesViewMode })
  },
}))
