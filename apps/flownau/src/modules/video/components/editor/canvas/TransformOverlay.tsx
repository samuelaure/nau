'use client'

import React, { useRef, useEffect, useState } from 'react'
import { useEditorStore } from '@/modules/video/store/useEditorStore'
import { ElementStyle } from '@/types/video-schema'

interface TransformOverlayProps {
  containerWidth: number
  containerHeight: number
}

export const TransformOverlay: React.FC<TransformOverlayProps> = ({
  containerWidth,
  containerHeight,
}) => {
  const template = useEditorStore((state) => state.template)
  const selectedElementId = useEditorStore((state) => state.selectedElementId)
  const updateElementStyle = useEditorStore((state) => state.updateElementStyle)

  // Local state for dragging/resizing to keep updates smooth
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [elementStart, setElementStart] = useState({ x: 0, y: 0, w: 0, h: 0 })
  const [elementStyleAtStart, setElementStyleAtStart] = useState<ElementStyle | null>(null)

  const selectedElement = template.elements.find((el) => el.id === selectedElementId)

  const handleMouseUp = () => {
    if ((isDragging || isResizing) && selectedElement && elementStyleAtStart) {
      // Commit the final state to history
      updateElementStyle(
        selectedElement.id,
        { ...selectedElement.style },
        true,
        elementStyleAtStart,
      )
    }
    setIsDragging(false)
    setIsResizing(null)
    setElementStyleAtStart(null)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!selectedElement) return

    const scaleX = containerWidth / template.width
    const scaleY = containerHeight / template.height

    const dx = (e.clientX - dragStart.x) / scaleX
    const dy = (e.clientY - dragStart.y) / scaleY

    if (isDragging) {
      updateElementStyle(
        selectedElement.id,
        {
          x: elementStart.x + dx,
          y: elementStart.y + dy,
        },
        false,
      )
    } else if (isResizing) {
      let newX = elementStart.x
      let newY = elementStart.y
      let newW = elementStart.w
      let newH = elementStart.h

      const isCorner = ['nw', 'ne', 'sw', 'se'].includes(isResizing)
      const aspectRatio = elementStart.h !== 0 ? elementStart.w / elementStart.h : 1

      let potentialNewW = elementStart.w
      let potentialNewH = elementStart.h

      if (isResizing.includes('w')) potentialNewW = elementStart.w - dx
      if (isResizing.includes('e')) potentialNewW = elementStart.w + dx
      if (isResizing.includes('n')) potentialNewH = elementStart.h - dy
      if (isResizing.includes('s')) potentialNewH = elementStart.h + dy

      if (isCorner) {
        if (Math.abs(dx) > Math.abs(dy)) {
          newW = potentialNewW
          newH = newW / aspectRatio
        } else {
          newH = potentialNewH
          newW = newH * aspectRatio
        }
      } else {
        newW = potentialNewW
        newH = potentialNewH
      }

      newW = Math.max(10, newW)
      newH = Math.max(10, newH)

      if (isResizing.includes('w')) newX = elementStart.x + (elementStart.w - newW)
      if (isResizing.includes('n')) newY = elementStart.y + (elementStart.h - newH)

      updateElementStyle(
        selectedElement.id,
        {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        },
        false,
      )
    }
  }

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [
    isDragging,
    isResizing,
    selectedElement,
    dragStart,
    elementStart,
    containerWidth,
    containerHeight,
    template.width,
    template.height,
  ])

  if (!selectedElement) return null

  const scaleX = containerWidth / template.width
  const scaleY = containerHeight / template.height

  const { x, y, width, height, rotation, scale: itemScale } = selectedElement.style

  const elWidth = width || template.width
  const elHeight = height || (width ? width * (9 / 16) : template.height)

  const screenX = x * scaleX
  const screenY = y * scaleY
  const screenW = elWidth * scaleX * itemScale
  const screenH = elHeight * scaleY * itemScale

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setElementStart({ x, y, w: elWidth, h: elHeight })
    setElementStyleAtStart({ ...selectedElement.style })
  }

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.stopPropagation()
    e.preventDefault()
    setIsResizing(direction)
    setDragStart({ x: e.clientX, y: e.clientY })
    setElementStart({ x, y, w: elWidth, h: elHeight })
    setElementStyleAtStart({ ...selectedElement.style })
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div
        className="absolute border-2 border-accent shadow-[0_0_15px_rgba(124,58,237,0.3)] pointer-events-auto cursor-move"
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
          transform: `rotate(${rotation}deg)`,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Resize Handles */}
        {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((cursor) => (
          <div
            key={cursor}
            onMouseDown={(e) => handleResizeStart(e, cursor)}
            className={`
                            absolute w-2.5 h-2.5 bg-white border border-accent rounded-full z-20 transition-transform hover:scale-150
                            ${getCursorClass(cursor)}
                        `}
            style={getHandleStyle(cursor as any)}
          />
        ))}

        {/* Selection Indicators */}
        <div className="absolute -top-6 left-0 bg-accent text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
          {selectedElement.name}
        </div>
      </div>
    </div>
  )
}

function getCursorClass(pos: string) {
  switch (pos) {
    case 'nw':
      return 'cursor-nw-resize'
    case 'ne':
      return 'cursor-ne-resize'
    case 'sw':
      return 'cursor-sw-resize'
    case 'se':
      return 'cursor-se-resize'
    case 'n':
      return 'cursor-n-resize'
    case 's':
      return 'cursor-s-resize'
    case 'e':
      return 'cursor-e-resize'
    case 'w':
      return 'cursor-w-resize'
    default:
      return ''
  }
}

function getHandleStyle(pos: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w') {
  const offset = '-5px'
  const center = 'calc(50% - 5px)'

  switch (pos) {
    case 'nw':
      return { top: offset, left: offset }
    case 'ne':
      return { top: offset, right: offset }
    case 'sw':
      return { bottom: offset, left: offset }
    case 'se':
      return { bottom: offset, right: offset }
    case 'n':
      return { top: offset, left: center }
    case 's':
      return { bottom: offset, left: center }
    case 'e':
      return { top: center, right: offset }
    case 'w':
      return { top: center, left: offset }
  }
}
