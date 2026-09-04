import { useShellStore } from './shell-store'

describe('shell-store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    useShellStore.setState({ isSidebarOpen: true, isDarkMode: true, notesViewMode: 'grid' })
  })

  it('starts dark by default (SSR-safe, matches the inline anti-flash script in layout.tsx)', () => {
    expect(useShellStore.getState().isDarkMode).toBe(true)
  })

  it('toggleSidebar flips isSidebarOpen', () => {
    useShellStore.getState().toggleSidebar()
    expect(useShellStore.getState().isSidebarOpen).toBe(false)
  })

  it('toggleDarkMode flips the flag, persists it, and toggles the html class', () => {
    useShellStore.getState().toggleDarkMode()
    expect(useShellStore.getState().isDarkMode).toBe(false)
    expect(localStorage.getItem('nau:theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setNotesViewMode persists the mode', () => {
    useShellStore.getState().setNotesViewMode('list')
    expect(useShellStore.getState().notesViewMode).toBe('list')
    expect(localStorage.getItem('nau:notes-view-mode')).toBe('list')
  })

  describe('hydrateFromStorage', () => {
    it('picks up an explicit light preference', () => {
      localStorage.setItem('nau:theme', 'light')
      useShellStore.getState().hydrateFromStorage()
      expect(useShellStore.getState().isDarkMode).toBe(false)
    })

    it('defaults to dark when nothing is stored, or anything other than "light" is', () => {
      useShellStore.getState().hydrateFromStorage()
      expect(useShellStore.getState().isDarkMode).toBe(true)

      localStorage.setItem('nau:theme', 'something-unexpected')
      useShellStore.getState().hydrateFromStorage()
      expect(useShellStore.getState().isDarkMode).toBe(true)
    })

    it('picks up a stored notesViewMode when valid', () => {
      localStorage.setItem('nau:notes-view-mode', 'list')
      useShellStore.getState().hydrateFromStorage()
      expect(useShellStore.getState().notesViewMode).toBe('list')
    })

    it('falls back to grid for an invalid stored notesViewMode — this is the validation the shared helper adds', () => {
      localStorage.setItem('nau:notes-view-mode', 'garbage')
      useShellStore.getState().hydrateFromStorage()
      expect(useShellStore.getState().notesViewMode).toBe('grid')
    })

    it('applies the dark class to <html> to match', () => {
      localStorage.setItem('nau:theme', 'light')
      useShellStore.getState().hydrateFromStorage()
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })
})
