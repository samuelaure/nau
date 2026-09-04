import { create } from 'zustand'
import { Block } from '@9nau/types'
import { RefObject } from 'react'
import type { Granularity } from '@/actions/periods'

type ViewMode = 'list' | 'horizontal'

type DropTarget = {
  id: string | null
  position: 'above' | 'below' | 'on' | 'end'
  date: string
  section: string
}

export interface DashboardState {
  viewMode: ViewMode
  currentDate: Date
  /**
   * The size of the periods the list is made of.
   *
   * Days, weeks, months, quarters or years — the same scroll, at whichever
   * grain. Stored here rather than in the view so that switching grain keeps
   * everything else in place.
   */
  granularity: Granularity
  /** How many periods are shown behind and ahead of the current one. */
  visiblePast: number
  visibleFuture: number
  draggedItem: Block | null
  dropTarget: DropTarget | null
  allBlocks: Block[]
  focusedItemId: string | null
  mainContentRef: RefObject<HTMLDivElement> | null
  todayRef: RefObject<HTMLDivElement> | null
  actions: {
    setViewMode: (mode: ViewMode) => void
    setCurrentDate: (date: Date) => void
    setGranularity: (granularity: Granularity) => void
    loadMorePast: () => void
    loadMoreFuture: () => void
    hideFuture: () => void
    setDraggedItem: (item: Block | null) => void
    setDropTarget: (target: DropTarget | null) => void
    setAllBlocks: (blocks: Block[]) => void
    setFocusedItemId: (id: string | null) => void
    setMainContentRef: (ref: RefObject<HTMLDivElement>) => void
    setTodayRef: (ref: RefObject<HTMLDivElement>) => void
  }
}

const useDashboardStore = create<DashboardState>((set) => ({
  viewMode: 'list',
  currentDate: new Date(),
  granularity: 'day',
  visiblePast: 7,
  visibleFuture: 0,
  draggedItem: null,
  dropTarget: null,
  allBlocks: [],
  focusedItemId: null,
  mainContentRef: null,
  todayRef: null,
  actions: {
    setViewMode: (mode) => set({ viewMode: mode }),
    setCurrentDate: (date) => set({ currentDate: date }),
    // Changing grain resets the window. Seven years of scroll left over from
    // seven days would be a very long list and never what was meant.
    setGranularity: (granularity) => set({ granularity, visiblePast: 7, visibleFuture: 0 }),
    loadMorePast: () => set((state) => ({ visiblePast: state.visiblePast + 7 })),
    // Three at a time. Future periods render above the current one, so nine
    // would push today off the screen and make reaching it work.
    loadMoreFuture: () => set((state) => ({ visibleFuture: state.visibleFuture + 3 })),
    hideFuture: () => set({ visibleFuture: 0 }),
    setDraggedItem: (item) => {
      set({ draggedItem: item })
      if (item === null) {
        set({ dropTarget: null })
      }
    },
    setDropTarget: (target) => set({ dropTarget: target }),
    setAllBlocks: (blocks) => set({ allBlocks: blocks }),
    setFocusedItemId: (id) => set({ focusedItemId: id }),
    setMainContentRef: (ref) => set({ mainContentRef: ref }),
    setTodayRef: (ref) => set({ todayRef: ref }),
  },
}))

export { useDashboardStore }
