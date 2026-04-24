import { create } from 'zustand'

export interface Command {
  type: string
  execute: () => void
  undo: () => void
  timestamp: number
}

interface HistoryState {
  past: Command[]
  future: Command[]
  canUndo: boolean
  canRedo: boolean

  // Actions
  execute: (command: Command) => void
  undo: () => void
  redo: () => void
  clear: () => void
}

const MAX_HISTORY = 50

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  execute: (command: Command) => {
    // Execute the command
    command.execute()

    set((state) => {
      const newPast = [...state.past, command]

      // Limit history size (FIFO)
      if (newPast.length > MAX_HISTORY) {
        newPast.shift()
      }

      return {
        past: newPast,
        future: [], // Clear future when a new action is performed
        canUndo: true,
        canRedo: false,
      }
    })
  },

  undo: () => {
    const { past, future } = get()
    if (past.length === 0) return

    const newPast = [...past]
    const command = newPast.pop()

    if (command) {
      // Perform undo
      command.undo()

      set({
        past: newPast,
        future: [command, ...future],
        canUndo: newPast.length > 0,
        canRedo: true,
      })
    }
  },

  redo: () => {
    const { past, future } = get()
    if (future.length === 0) return

    const newFuture = [...future]
    const command = newFuture.shift()

    if (command) {
      // Perform redo (which is just executing again)
      command.execute()

      set({
        past: [...past, command],
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
      })
    }
  },

  clear: () => {
    set({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
  },
}))
