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
  const stored = localStorage.getItem(GROUP_BY_KEY)
  return stored === 'createdAt' || stored === 'updatedAt' ? stored : 'none'
}

interface NotesViewState {
  groupBy: NotesGroupBy
  setGroupBy: (groupBy: NotesGroupBy) => void
  /** Pulls in whatever was persisted, once mounted client-side. See hydrateFromStorage below for why this can't happen at store-creation time. */
  hydrateFromStorage: () => void
}

/**
 * Always starts at `none` — even in the browser, even if `localStorage`
 * holds something else. Reading `localStorage` inside `create()`'s
 * initializer runs at module-evaluation time, which on the very first
 * client render happens *before* React reconciles against the server's
 * markup; if a returning visitor had `createdAt` stored, the initial
 * client render would show that while the server-rendered HTML it's
 * hydrating against always shows `none` (the server has no `localStorage`)
 * — a text mismatch React surfaces as a hydration error and recovers from
 * by discarding the server tree entirely. `GroupBySelector` calls
 * `hydrateFromStorage()` in a `useEffect` instead, which by definition runs
 * after the first paint is already committed and matched, then updates to
 * the persisted value the same way any other post-mount state change would.
 */
export const useNotesViewStore = create<NotesViewState>((set) => ({
  groupBy: 'none',
  setGroupBy: (groupBy) =>
    set(() => {
      if (typeof window !== 'undefined') localStorage.setItem(GROUP_BY_KEY, groupBy)
      return { groupBy }
    }),
  hydrateFromStorage: () => {
    if (typeof window === 'undefined') return
    set({ groupBy: loadGroupBy() })
  },
}))
