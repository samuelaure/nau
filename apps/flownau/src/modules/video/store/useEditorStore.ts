import { create } from 'zustand'
import { VideoTemplate, VideoElement, ElementStyle } from '@/types/video-schema'
import { useHistoryStore } from './useHistoryStore'

interface EditorState {
  template: VideoTemplate
  selectedElementId: string | null

  // Actions
  setTemplate: (template: VideoTemplate) => void
  updateTemplate: (updates: Partial<VideoTemplate>) => void
  setSelectedElementId: (id: string | null) => void

  addElement: (
    type: VideoElement['type'],
    asset?: { url: string; name: string; width?: number; height?: number },
  ) => void
  updateElement: (id: string, changes: Partial<Omit<VideoElement, 'style'>>) => void
  updateElementStyle: (
    id: string,
    styleChanges: Partial<ElementStyle>,
    recordHistory?: boolean,
    customOldStyle?: Partial<ElementStyle>,
  ) => void
  deleteElement: (id: string) => void
  reorderElement: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void
  splitElement: (id: string, frame: number) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  template: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 150,
    elements: [],
  },
  selectedElementId: null,

  setTemplate: (template) => set({ template }),

  updateTemplate: (updates) =>
    set((state) => ({
      template: { ...state.template, ...updates },
    })),

  setSelectedElementId: (id) => set({ selectedElementId: id }),

  addElement: (type, asset) => {
    const { template } = get()
    let initialWidth = type === 'text' ? undefined : template.width * 0.5
    let initialHeight = undefined

    if (asset?.width && asset?.height) {
      let w = asset.width
      let h = asset.height

      if (w > template.width * 0.8 || h > template.height * 0.8) {
        const s = Math.min((template.width * 0.8) / w, (template.height * 0.8) / h)
        w *= s
        h *= s
      }

      initialWidth = w
      initialHeight = h
    }

    const newElement: VideoElement = {
      id: crypto.randomUUID(),
      type,
      name: asset?.name || `New ${type}`,
      startFrame: 0,
      durationInFrames: template.durationInFrames,
      mediaStartOffset: 0,
      content: asset?.url || (type === 'text' ? 'New Text' : ''),
      fadeInDuration: 0,
      fadeOutDuration: 0,
      style: {
        x: 0,
        y: 0,
        width: initialWidth,
        height: initialHeight,
        scale: 1,
        rotation: 0,
        opacity: 1,
        fontSize: 40,
        textAlign: 'left',
        color: '#ffffff',
      },
    }

    // Center logic
    if (newElement.style.width && newElement.style.height) {
      newElement.style.x = (template.width - newElement.style.width) / 2
      newElement.style.y = (template.height - newElement.style.height) / 2
    } else if (newElement.style.width) {
      newElement.style.x = (template.width - newElement.style.width) / 2
      newElement.style.y = template.height / 2 - (newElement.style.width * 9) / 16 / 2
    } else {
      newElement.style.x = template.width / 2
      newElement.style.y = template.height / 2
    }

    const oldElements = template.elements

    const execute = () => {
      set((state) => ({
        template: {
          ...state.template,
          elements: [...state.template.elements, newElement],
        },
        selectedElementId: newElement.id,
      }))
    }

    const undo = () => {
      set((state) => ({
        template: {
          ...state.template,
          elements: oldElements,
        },
        selectedElementId:
          state.selectedElementId === newElement.id ? null : state.selectedElementId,
      }))
    }

    useHistoryStore.getState().execute({
      type: 'ADD_ELEMENT',
      execute,
      undo,
      timestamp: Date.now(),
    })
  },

  updateElement: (id, changes) => {
    const oldElement = get().template.elements.find((el) => el.id === id)
    if (!oldElement) return

    const execute = () => {
      set((state) => ({
        template: {
          ...state.template,
          elements: state.template.elements.map((el) =>
            el.id === id ? { ...el, ...changes } : el,
          ),
        },
      }))
    }

    const undo = () => {
      set((state) => ({
        template: {
          ...state.template,
          elements: state.template.elements.map((el) =>
            el.id === id ? { ...el, ...oldElement } : el,
          ),
        },
      }))
    }

    useHistoryStore.getState().execute({
      type: 'UPDATE_ELEMENT',
      execute,
      undo,
      timestamp: Date.now(),
    })
  },

  updateElementStyle: (id, styleChanges, recordHistory = true, customOldStyle) => {
    const oldElement = get().template.elements.find((el) => el.id === id)
    if (!oldElement) return

    const execute = () => {
      set((state) => ({
        template: {
          ...state.template,
          elements: state.template.elements.map((el) =>
            el.id === id ? { ...el, style: { ...el.style, ...styleChanges } } : el,
          ),
        },
      }))
    }

    if (!recordHistory) {
      execute()
      return
    }

    const oldStyleSnapshot = customOldStyle ? { ...customOldStyle } : { ...oldElement.style }
    const undo = () => {
      set((state) => ({
        template: {
          ...state.template,
          elements: state.template.elements.map((el) =>
            el.id === id ? { ...el, style: { ...el.style, ...oldStyleSnapshot } } : el,
          ),
        },
      }))
    }

    useHistoryStore.getState().execute({
      type: 'UPDATE_ELEMENT_STYLE',
      execute,
      undo,
      timestamp: Date.now(),
    })
  },

  deleteElement: (id) => {
    const oldElements = get().template.elements
    const deletedElement = oldElements.find((el) => el.id === id)
    if (!deletedElement) return

    const execute = () => {
      set((state) => ({
        template: {
          ...state.template,
          elements: state.template.elements.filter((el) => el.id !== id),
        },
        selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
      }))
    }

    const undo = () => {
      set((state) => ({
        template: {
          ...state.template,
          elements: oldElements,
        },
        selectedElementId: id,
      }))
    }

    useHistoryStore.getState().execute({
      type: 'DELETE_ELEMENT',
      execute,
      undo,
      timestamp: Date.now(),
    })
  },

  reorderElement: (id, direction) => {
    const oldElements = get().template.elements

    const executeAction = (dir: 'up' | 'down' | 'top' | 'bottom') => {
      set((state) => {
        const index = state.template.elements.findIndex((el) => el.id === id)
        if (index === -1) return state

        const newElements = [...state.template.elements]
        const element = newElements[index]

        if (dir === 'up') {
          if (index < newElements.length - 1) {
            newElements[index] = newElements[index + 1]
            newElements[index + 1] = element
          }
        } else if (dir === 'down') {
          if (index > 0) {
            newElements[index] = newElements[index - 1]
            newElements[index - 1] = element
          }
        } else if (dir === 'top') {
          newElements.splice(index, 1)
          newElements.push(element)
        } else if (dir === 'bottom') {
          newElements.splice(index, 1)
          newElements.unshift(element)
        }

        return {
          template: { ...state.template, elements: newElements },
        }
      })
    }

    const execute = () => executeAction(direction)
    const undo = () => {
      set((state) => ({
        template: { ...state.template, elements: oldElements },
      }))
    }

    useHistoryStore.getState().execute({
      type: 'REORDER_ELEMENT',
      execute,
      undo,
      timestamp: Date.now(),
    })
  },

  splitElement: (id, splitFrame) => {
    const oldElements = get().template.elements
    const element = oldElements.find((e) => e.id === id)
    if (!element) return

    if (
      splitFrame <= element.startFrame ||
      splitFrame >= element.startFrame + element.durationInFrames
    ) {
      return
    }

    const splitOffset = splitFrame - element.startFrame
    const leftClip: VideoElement = { ...element, durationInFrames: splitOffset }
    const rightClip: VideoElement = {
      ...element,
      id: crypto.randomUUID(),
      startFrame: splitFrame,
      durationInFrames: element.durationInFrames - splitOffset,
      mediaStartOffset: element.mediaStartOffset + splitOffset,
      name: `${element.name} (Split)`,
    }

    const execute = () => {
      set((state) => {
        const elementIndex = state.template.elements.findIndex((e) => e.id === id)
        const newElements = [...state.template.elements]
        newElements.splice(elementIndex, 1, leftClip, rightClip)
        return {
          template: { ...state.template, elements: newElements },
          selectedElementId: rightClip.id,
        }
      })
    }

    const undo = () => {
      set((state) => ({
        template: { ...state.template, elements: oldElements },
        selectedElementId: id,
      }))
    }

    useHistoryStore.getState().execute({
      type: 'SPLIT_ELEMENT',
      execute,
      undo,
      timestamp: Date.now(),
    })
  },
}))
