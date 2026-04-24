import { create } from 'zustand'

interface PlaybackState {
  currentFrame: number
  isPlaying: boolean
  setCurrentFrame: (frame: number) => void
  setIsPlaying: (playing: boolean) => void
  togglePlaying: () => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  currentFrame: 0,
  isPlaying: false,
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
}))
