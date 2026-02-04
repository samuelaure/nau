import { VideoTemplate } from '@/types/video-schema'

const AUTOSAVE_PREFIX = 'flownau_autosave_'

export function saveToLocalStorage(templateId: string, template: VideoTemplate) {
  try {
    const data = {
      template,
      timestamp: Date.now(),
    }
    localStorage.setItem(`${AUTOSAVE_PREFIX}${templateId}`, JSON.stringify(data))
  } catch (error) {
    console.warn('Failed to save to localStorage:', error)
  }
}

export function loadFromLocalStorage(templateId: string): {
  template: VideoTemplate
  timestamp: number
} | null {
  try {
    const item = localStorage.getItem(`${AUTOSAVE_PREFIX}${templateId}`)
    if (!item) return null
    return JSON.parse(item)
  } catch (error) {
    console.warn('Failed to load from localStorage:', error)
    return null
  }
}

export function clearAutosave(templateId: string) {
  try {
    localStorage.removeItem(`${AUTOSAVE_PREFIX}${templateId}`)
  } catch (error) {
    console.warn('Failed to clear autosave from localStorage:', error)
  }
}
