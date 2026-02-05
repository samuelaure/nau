/**
 * Font Loading Utility
 * Provides indicators and utilities for tracking font loading states
 */

export type FontLoadingState = 'loading' | 'loaded' | 'error'

export interface FontDescriptor {
  family: string
  weight?: string | number
  style?: string
}

/**
 * Check if a font is loaded using the CSS Font Loading API
 */
export async function checkFontLoaded(font: FontDescriptor): Promise<boolean> {
  if (!('fonts' in document)) {
    console.warn('CSS Font Loading API not supported')
    return true // Assume loaded if API not available
  }

  const fontString = `${font.weight || 400} 16px "${font.family}"`

  try {
    await document.fonts.load(fontString)
    return document.fonts.check(fontString)
  } catch (error) {
    console.error(`Failed to check font: ${font.family}`, error)
    return false
  }
}

/**
 * Load multiple fonts and track their loading state
 */
export async function loadFonts(fonts: FontDescriptor[]): Promise<Map<string, FontLoadingState>> {
  const results = new Map<string, FontLoadingState>()

  const promises = fonts.map(async (font) => {
    const key = `${font.family}-${font.weight || 400}-${font.style || 'normal'}`
    results.set(key, 'loading')

    try {
      const loaded = await checkFontLoaded(font)
      results.set(key, loaded ? 'loaded' : 'error')
    } catch (error) {
      results.set(key, 'error')
    }
  })

  await Promise.all(promises)
  return results
}

/**
 * Wait for all fonts to be ready
 */
export async function waitForFonts(timeout = 3000): Promise<boolean> {
  if (!('fonts' in document)) {
    return true
  }

  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Font loading timeout')), timeout),
      ),
    ])
    return true
  } catch (error) {
    console.warn('Font loading timeout reached', error)
    return false
  }
}

/**
 * Get the current loading state of all fonts
 */
export function getFontLoadingStatus(): {
  loading: number
  loaded: number
  failed: number
  total: number
} {
  if (!('fonts' in document)) {
    return { loading: 0, loaded: 0, failed: 0, total: 0 }
  }

  const fonts = Array.from(document.fonts)
  const loading = fonts.filter((f) => f.status === 'loading').length
  const loaded = fonts.filter((f) => f.status === 'loaded').length
  const failed = fonts.filter((f) => f.status === 'error').length

  return {
    loading,
    loaded,
    failed,
    total: fonts.length,
  }
}
