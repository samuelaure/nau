import { create } from 'zustand'
import { VideoTemplate, VideoElement, ElementStyle } from '@/types/video-schema'

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
  updateElementStyle: (id: string, styleChanges: Partial<ElementStyle>) => void
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

    set((state) => ({
      template: {
        ...state.template,
        elements: [...state.template.elements, newElement],
      },
      selectedElementId: newElement.id,
    }))
  },

  updateElement: (id, changes) => {
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) => (el.id === id ? { ...el, ...changes } : el)),
      },
    }))
  },

  updateElementStyle: (id, styleChanges) => {
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === id ? { ...el, style: { ...el.style, ...styleChanges } } : el,
        ),
      },
    }))
  },

  deleteElement: (id) => {
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.filter((el) => el.id !== id),
      },
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
    }))
  },

  reorderElement: (id, direction) => {
    set((state) => {
      const index = state.template.elements.findIndex((el) => el.id === id)
      if (index === -1) return state

      const newElements = [...state.template.elements]
      const element = newElements[index]

      if (direction === 'up') {
        if (index < newElements.length - 1) {
          newElements[index] = newElements[index + 1]
          newElements[index + 1] = element
        }
      } else if (direction === 'down') {
        if (index > 0) {
          newElements[index] = newElements[index - 1]
          newElements[index - 1] = element
        }
      } else if (direction === 'top') {
        newElements.splice(index, 1)
        newElements.push(element)
      } else if (direction === 'bottom') {
        newElements.splice(index, 1)
        newElements.unshift(element)
      }

      return {
        template: { ...state.template, elements: newElements },
      }
    })
  },

  splitElement: (id, splitFrame) => {
    set((state) => {
      const element = state.template.elements.find((e) => e.id === id)
      if (!element) return state

      if (
        splitFrame <= element.startFrame ||
        splitFrame >= element.startFrame + element.durationInFrames
      ) {
        return state
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

      const elementIndex = state.template.elements.findIndex((e) => e.id === id)
      const newElements = [...state.template.elements]
      newElements.splice(elementIndex, 1, leftClip, rightClip)

      return {
        template: { ...state.template, elements: newElements },
        selectedElementId: rightClip.id,
      }
    })
  },
}))
