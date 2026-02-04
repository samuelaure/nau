import { useEditorStore } from '../store/useEditorStore'
import { Command } from '../store/useHistoryStore'
import { VideoElement, ElementStyle, VideoTemplate } from '@/types/video-schema'

/**
 * AddElementCommand
 * Adds a new element to the template.
 */
export class AddElementCommand implements Command {
  type = 'ADD_ELEMENT'
  timestamp = Date.now()
  private elementId: string | null = null

  constructor(private element: VideoElement) {
    this.elementId = element.id
  }

  execute() {
    const { setTemplate } = useEditorStore.getState()
    useEditorStore.setState((state) => ({
      template: {
        ...state.template,
        elements: [...state.template.elements, this.element],
      },
      selectedElementId: this.element.id,
    }))
  }

  undo() {
    useEditorStore.setState((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.filter((el) => el.id !== this.elementId),
      },
      selectedElementId:
        state.selectedElementId === this.elementId ? null : state.selectedElementId,
    }))
  }
}

/**
 * UpdateElementCommand
 * Updates properties of an existing element.
 */
export class UpdateElementCommand implements Command {
  type = 'UPDATE_ELEMENT'
  timestamp = Date.now()
  private oldData: Partial<VideoElement>

  constructor(
    private id: string,
    private newData: Partial<VideoElement>,
  ) {
    const element = useEditorStore.getState().template.elements.find((el) => el.id === id)
    this.oldData = element ? { ...element } : {}
  }

  execute() {
    const { updateElement } = useEditorStore.getState()
    // We use setState directly to avoid recursion if we wrap the store action later
    useEditorStore.setState((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === this.id ? { ...el, ...this.newData } : el,
        ),
      },
    }))
  }

  undo() {
    useEditorStore.setState((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === this.id ? { ...el, ...this.oldData } : el,
        ),
      },
    }))
  }
}

/**
 * UpdateElementStyleCommand
 * Updates style properties of an existing element.
 */
export class UpdateElementStyleCommand implements Command {
  type = 'UPDATE_ELEMENT_STYLE'
  timestamp = Date.now()
  private oldStyle: Partial<ElementStyle>

  constructor(
    private id: string,
    private newStyle: Partial<ElementStyle>,
  ) {
    const element = useEditorStore.getState().template.elements.find((el) => el.id === id)
    this.oldStyle = element ? { ...element.style } : {}
  }

  execute() {
    useEditorStore.setState((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === this.id ? { ...el, style: { ...el.style, ...this.newStyle } } : el,
        ),
      },
    }))
  }

  undo() {
    useEditorStore.setState((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === this.id ? { ...el, style: { ...el.style, ...this.oldStyle } } : el,
        ),
      },
    }))
  }
}

/**
 * DeleteElementCommand
 * Deletes an element and stores it for potential undo.
 */
export class DeleteElementCommand implements Command {
  type = 'DELETE_ELEMENT'
  timestamp = Date.now()
  private deletedElement: VideoElement | null = null
  private originalIndex: number = -1

  constructor(private id: string) {
    const state = useEditorStore.getState()
    const index = state.template.elements.findIndex((el) => el.id === id)
    if (index !== -1) {
      this.deletedElement = { ...state.template.elements[index] }
      this.originalIndex = index
    }
  }

  execute() {
    useEditorStore.setState((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.filter((el) => el.id !== this.id),
      },
      selectedElementId: state.selectedElementId === this.id ? null : state.selectedElementId,
    }))
  }

  undo() {
    if (!this.deletedElement || this.originalIndex === -1) return

    useEditorStore.setState((state) => {
      const newElements = [...state.template.elements]
      newElements.splice(this.originalIndex, 0, this.deletedElement!)
      return {
        template: {
          ...state.template,
          elements: newElements,
        },
        selectedElementId: this.id,
      }
    })
  }
}

/**
 * SplitElementCommand
 * Splits a clip into two.
 */
export class SplitElementCommand implements Command {
  type = 'SPLIT_ELEMENT'
  timestamp = Date.now()
  private originalElement: VideoElement | null = null
  private rightClipId: string | null = null
  private originalIndex: number = -1

  constructor(
    private id: string,
    private splitFrame: number,
  ) {
    const state = useEditorStore.getState()
    const index = state.template.elements.findIndex((el) => el.id === id)
    if (index !== -1) {
      this.originalElement = { ...state.template.elements[index] }
      this.originalIndex = index
    }
  }

  execute() {
    if (!this.originalElement) return

    const { template } = useEditorStore.getState()
    const element = this.originalElement

    const splitOffset = this.splitFrame - element.startFrame
    const leftClip: VideoElement = { ...element, durationInFrames: splitOffset }
    const rightClip: VideoElement = {
      ...element,
      id: crypto.randomUUID(),
      startFrame: this.splitFrame,
      durationInFrames: element.durationInFrames - splitOffset,
      mediaStartOffset: element.mediaStartOffset + splitOffset,
      name: `${element.name} (Split)`,
    }
    this.rightClipId = rightClip.id

    useEditorStore.setState((state) => {
      const newElements = [...state.template.elements]
      newElements.splice(this.originalIndex, 1, leftClip, rightClip)
      return {
        template: { ...state.template, elements: newElements },
        selectedElementId: rightClip.id,
      }
    })
  }

  undo() {
    if (!this.originalElement || this.originalIndex === -1) return

    useEditorStore.setState((state) => {
      const newElements = [...state.template.elements]
      // Remove the split clips (they were at originalIndex and originalIndex + 1)
      newElements.splice(this.originalIndex, 2, this.originalElement!)
      return {
        template: { ...state.template, elements: newElements },
        selectedElementId: this.id,
      }
    })
  }
}

/**
 * ReorderElementCommand
 * Changes the Z-index (array order) of an element.
 */
export class ReorderElementCommand implements Command {
  type = 'REORDER_ELEMENT'
  timestamp = Date.now()
  private oldElements: VideoElement[]

  constructor(
    private id: string,
    private direction: 'up' | 'down' | 'top' | 'bottom',
  ) {
    this.oldElements = [...useEditorStore.getState().template.elements]
  }

  execute() {
    const { reorderElement } = useEditorStore.getState()
    // We can't use the store's action directly because it doesn't give us the new state easily
    // So we replicate the logic or use a helper
    useEditorStore.setState((state) => {
      const index = state.template.elements.findIndex((el) => el.id === this.id)
      if (index === -1) return state

      const newElements = [...state.template.elements]
      const element = newElements[index]

      if (this.direction === 'up') {
        if (index < newElements.length - 1) {
          newElements[index] = newElements[index + 1]
          newElements[index + 1] = element
        }
      } else if (this.direction === 'down') {
        if (index > 0) {
          newElements[index] = newElements[index - 1]
          newElements[index - 1] = element
        }
      } else if (this.direction === 'top') {
        newElements.splice(index, 1)
        newElements.push(element)
      } else if (this.direction === 'bottom') {
        newElements.splice(index, 1)
        newElements.unshift(element)
      }

      return {
        template: { ...state.template, elements: newElements },
      }
    })
  }

  undo() {
    useEditorStore.setState((state) => ({
      template: { ...state.template, elements: this.oldElements },
    }))
  }
}
