import { useNotesViewStore } from './notes-view-store'

describe('notes-view-store', () => {
  beforeEach(() => {
    localStorage.clear()
    useNotesViewStore.setState({ groupBy: 'none' })
  })

  it('starts at "none" (SSR-safe default)', () => {
    expect(useNotesViewStore.getState().groupBy).toBe('none')
  })

  it('setGroupBy persists the value', () => {
    useNotesViewStore.getState().setGroupBy('createdAt')
    expect(useNotesViewStore.getState().groupBy).toBe('createdAt')
    expect(localStorage.getItem('nau:notes-group-by')).toBe('createdAt')
  })

  describe('hydrateFromStorage', () => {
    it('picks up a valid stored value', () => {
      localStorage.setItem('nau:notes-group-by', 'updatedAt')
      useNotesViewStore.getState().hydrateFromStorage()
      expect(useNotesViewStore.getState().groupBy).toBe('updatedAt')
    })

    it('falls back to "none" for an invalid stored value', () => {
      localStorage.setItem('nau:notes-group-by', 'tag')
      useNotesViewStore.getState().hydrateFromStorage()
      expect(useNotesViewStore.getState().groupBy).toBe('none')
    })

    it('falls back to "none" when nothing is stored', () => {
      useNotesViewStore.getState().hydrateFromStorage()
      expect(useNotesViewStore.getState().groupBy).toBe('none')
    })
  })
})
