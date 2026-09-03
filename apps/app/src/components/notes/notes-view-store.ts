import { create } from 'zustand'

/**
 * How Bandeja General groups its notes — a Keep-style optional divider, not
 * a different query. `none` is the default (today's flat, ungrouped list).
 *
 * `tag` is a real option in the UI even though nothing populates it yet:
 * References has no tag field today (see nau#144 — nau-mobile's incoming
 * migration brings a tag system with nowhere to land). It renders disabled
 * rather than being omitted, so the gap stays visible in the UI itself
 * instead of only in the issue tracker.
 */
export type NotesGroupBy = 'none' | 'createdAt' | 'updatedAt'

const GROUP_BY_KEY = 'nau:notes-group-by'

function loadGroupBy(): NotesGroupBy {
  if (typeof window === 'undefined') return 'none'
  const stored = localStorage.getItem(GROUP_BY_KEY)
  return stored === 'createdAt' || stored === 'updatedAt' ? stored : 'none'
}

interface NotesViewState {
  groupBy: NotesGroupBy
  setGroupBy: (groupBy: NotesGroupBy) => void
}

export const useNotesViewStore = create<NotesViewState>((set) => ({
  groupBy: loadGroupBy(),
  setGroupBy: (groupBy) =>
    set(() => {
      if (typeof window !== 'undefined') localStorage.setItem(GROUP_BY_KEY, groupBy)
      return { groupBy }
    }),
}))
