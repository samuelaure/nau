import { create } from 'zustand'

interface CanvasState {
  zoom: number // 0.1 to 5.0
  pan: { x: number; y: number }

  // Actions
  setZoom: (zoom: number) => void
  setPan: (pan: { x: number; y: number }) => void
  resetCanvas: () => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  zoom: 1,
  pan: { x: 0, y: 0 },

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5.0, zoom)) }),
  setPan: (pan) => set({ pan }),
  resetCanvas: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
}))
