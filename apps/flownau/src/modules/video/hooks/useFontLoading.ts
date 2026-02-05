import { useState, useEffect } from 'react'
import {
  FontDescriptor,
  FontLoadingState,
  checkFontLoaded,
  waitForFonts,
} from '../utils/fontLoading'

/**
 * Hook to track font loading state
 */
export function useFontLoading(fonts: FontDescriptor[]) {
  const [fontStates, setFontStates] = useState<Map<string, FontLoadingState>>(new Map())
  const [allLoaded, setAllLoaded] = useState(false)

  useEffect(() => {
    const loadAllFonts = async () => {
      const states = new Map<string, FontLoadingState>()

      // Initialize all as loading
      fonts.forEach((font) => {
        const key = `${font.family}-${font.weight || 400}-${font.style || 'normal'}`
        states.set(key, 'loading')
      })
      setFontStates(new Map(states))

      // Load each font
      const promises = fonts.map(async (font) => {
        const key = `${font.family}-${font.weight || 400}-${font.style || 'normal'}`
        try {
          const loaded = await checkFontLoaded(font)
          states.set(key, loaded ? 'loaded' : 'error')
        } catch (error) {
          states.set(key, 'error')
        }
      })

      await Promise.all(promises)
      setFontStates(new Map(states))

      // Check if all loaded
      const allSuccess = Array.from(states.values()).every((state) => state === 'loaded')
      setAllLoaded(allSuccess)
    }

    if (fonts.length > 0) {
      loadAllFonts()
    }
  }, [fonts])

  return {
    fontStates,
    allLoaded,
    isLoading: Array.from(fontStates.values()).some((state) => state === 'loading'),
    hasErrors: Array.from(fontStates.values()).some((state) => state === 'error'),
  }
}

/**
 * Hook to wait for all fonts to be ready
 */
export function useWaitForFonts(timeout = 3000) {
  const [ready, setReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    waitForFonts(timeout)
      .then((success) => {
        setReady(true)
        setTimedOut(!success)
      })
      .catch(() => {
        setReady(true)
        setTimedOut(true)
      })
  }, [timeout])

  return { ready, timedOut }
}
