import React, { useRef, useState, useEffect, MouseEvent } from 'react'
import { useEditorStore } from '@/modules/video/store/useEditorStore'
import { usePlaybackStore } from '@/modules/video/store/usePlaybackStore'

// Optimized sub-components for avoiding full timeline re-renders
const Playhead = React.memo(
  ({ durationInFrames, timelineWidth }: { durationInFrames: number; timelineWidth: number }) => {
    const currentFrame = usePlaybackStore((state) => state.currentFrame)

    return (
      <div
        className="absolute top-0 bottom-0 w-px bg-accent z-50 pointer-events-none"
        style={{
          left: `16px`,
          transform: `translateX(${(currentFrame / durationInFrames) * (timelineWidth - 32)}px)`,
        }}
      >
        <div className="w-3 h-3 bg-accent rounded-full -ml-[5px] -mt-1 shadow-[0_0_10px_rgba(124,58,237,0.5)]" />
      </div>
    )
  },
)
Playhead.displayName = 'Playhead'

const CurrentTime = React.memo(
  ({ fps, durationInFrames }: { fps: number; durationInFrames: number }) => {
    const currentFrame = usePlaybackStore((state) => state.currentFrame)
    return (
      <div className="flex gap-4 font-mono">
        <span className="text-accent">{currentFrame}</span>
        <span className="opacity-30">/</span>
        <span>{durationInFrames} frames</span>
        <span className="text-text-secondary/50">{(currentFrame / fps).toFixed(2)}s</span>
      </div>
    )
  },
)
CurrentTime.displayName = 'CurrentTime'

interface TimelineClipProps {
  el: any
  durationInFrames: number
  selectedElementId: string | null
  draggingId: string | null
  resizingId: string | null
  resizeHandle: 'start' | 'end' | null
  originalStartFrame: number
  originalDuration: number
  dragFrameDelta: number
  onClipMouseDown: (e: MouseEvent<HTMLDivElement>, id: string, startFrame: number) => void
  onResizeMouseDown: (
    e: MouseEvent<HTMLDivElement>,
    id: string,
    startFrame: number,
    duration: number,
    mediaStartOffset: number,
    handle: 'start' | 'end',
  ) => void
}

const TimelineClip = React.memo(
  ({
    el,
    durationInFrames,
    selectedElementId,
    draggingId,
    resizingId,
    resizeHandle,
    originalStartFrame,
    originalDuration,
    dragFrameDelta,
    onClipMouseDown,
    onResizeMouseDown,
  }: TimelineClipProps) => {
    const isDragging = draggingId === el.id
    let displayStartFrame = el.startFrame
    let displayDuration = el.durationInFrames

    if (isDragging) {
      displayStartFrame = Math.max(0, originalStartFrame + dragFrameDelta)
    } else if (resizingId === el.id) {
      if (resizeHandle === 'start') {
        const maxStart = originalStartFrame + originalDuration - 1
        const rawNewStart = originalStartFrame + dragFrameDelta
        displayStartFrame = Math.max(0, Math.min(rawNewStart, maxStart))
        displayDuration = originalDuration - (displayStartFrame - originalStartFrame)
      } else {
        displayDuration = Math.max(1, originalDuration + dragFrameDelta)
      }
    }

    return (
      <div className="h-8 my-2 relative flex items-center group">
        <div
          onMouseDown={(e) => onClipMouseDown(e, el.id, el.startFrame)}
          className={`absolute h-6 rounded px-2 text-[10px] flex items-center border cursor-grab active:cursor-grabbing transition-colors group-hover:z-20 ${
            el.id === selectedElementId
              ? 'bg-accent border-white/20 text-white z-10 shadow-lg'
              : 'bg-zinc-800 border-white/5 text-text-secondary hover:bg-zinc-700 hover:text-white'
          } ${isDragging || resizingId === el.id ? 'opacity-90 ring-2 ring-accent ring-offset-2 ring-offset-[#161616] z-30' : ''}`}
          style={{
            left: `${(displayStartFrame / durationInFrames) * 100}%`,
            width: `${(displayDuration / durationInFrames) * 100}%`,
            transition:
              isDragging || resizingId === el.id
                ? 'none'
                : 'left 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <span className="overflow-hidden font-medium whitespace-nowrap pointer-events-none select-none w-full">
            {el.name}
          </span>

          {/* Resize Handles */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-w-resize hover:bg-white/20 z-20 transition-opacity ${el.id === selectedElementId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            onMouseDown={(e) =>
              onResizeMouseDown(
                e,
                el.id,
                el.startFrame,
                el.durationInFrames,
                el.mediaStartOffset,
                'start',
              )
            }
          />
          <div
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-e-resize hover:bg-white/20 z-20 transition-opacity ${el.id === selectedElementId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            onMouseDown={(e) =>
              onResizeMouseDown(
                e,
                el.id,
                el.startFrame,
                el.durationInFrames,
                el.mediaStartOffset,
                'end',
              )
            }
          />
        </div>
      </div>
    )
  },
)
TimelineClip.displayName = 'TimelineClip'

export function Timeline() {
  const template = useEditorStore((state) => state.template)
  const selectedElementId = useEditorStore((state) => state.selectedElementId)
  const setSelectedElementId = useEditorStore((state) => state.setSelectedElementId)
  const updateElement = useEditorStore((state) => state.updateElement)

  const setCurrentFrame = usePlaybackStore((state) => state.setCurrentFrame)
  const [timelineWidth, setTimelineWidth] = useState(0)

  const timelineRef = useRef<HTMLDivElement>(null)

  // Drag State
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [originalStartFrame, setOriginalStartFrame] = useState(0)
  const [dragFrameDelta, setDragFrameDelta] = useState(0)

  // Resize State
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [resizeHandle, setResizeHandle] = useState<'start' | 'end' | null>(null)
  const [originalDuration, setOriginalDuration] = useState(0)
  const [originalMediaStartOffset, setOriginalMediaStartOffset] = useState(0)

  // Scrubbing Logic
  const handleScrub = (e: MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()

    const padding = 16
    const availableWidth = rect.width - padding * 2
    const x = e.clientX - rect.left - padding

    const percentage = Math.max(0, Math.min(1, x / availableWidth))
    const frame = Math.round(percentage * template.durationInFrames)
    setCurrentFrame(frame)
  }

  // Clip Drag Logic
  const handleClipMouseDown = (e: MouseEvent<HTMLDivElement>, id: string, startFrame: number) => {
    e.stopPropagation()
    setDraggingId(id)
    setDragStartX(e.clientX)
    setOriginalStartFrame(startFrame)
    setDragFrameDelta(0)
    setSelectedElementId(id)
  }

  // Resize Logic
  const handleResizeMouseDown = (
    e: MouseEvent<HTMLDivElement>,
    id: string,
    startFrame: number,
    duration: number,
    mediaStartOffset: number,
    handle: 'start' | 'end',
  ) => {
    e.stopPropagation()
    setResizingId(id)
    setResizeHandle(handle)
    setDragStartX(e.clientX)
    setOriginalStartFrame(startFrame)
    setOriginalDuration(duration)
    setOriginalMediaStartOffset(mediaStartOffset)
    setDragFrameDelta(0)
    setSelectedElementId(id)
  }

  useEffect(() => {
    if (!draggingId && !resizingId) return

    const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
      if (!timelineRef.current) return

      const rect = timelineRef.current.getBoundingClientRect()
      const padding = 16
      const availableWidth = rect.width - padding * 2

      const pixelDelta = e.clientX - dragStartX
      const frameDelta = Math.round((pixelDelta / availableWidth) * template.durationInFrames)

      setDragFrameDelta(frameDelta)
    }

    const handleWindowMouseUp = () => {
      if (draggingId) {
        const newStartFrame = Math.max(0, originalStartFrame + dragFrameDelta)
        updateElement(draggingId, { startFrame: newStartFrame })
      } else if (resizingId && resizeHandle) {
        if (resizeHandle === 'start') {
          const newStart = Math.max(
            0,
            Math.min(
              originalStartFrame + dragFrameDelta,
              originalStartFrame + originalDuration - 1,
            ),
          )
          const changeInStart = newStart - originalStartFrame
          const newDuration = originalDuration - changeInStart
          const newMediaStartOffset = Math.max(0, originalMediaStartOffset + changeInStart)

          updateElement(resizingId, {
            startFrame: newStart,
            durationInFrames: newDuration,
            mediaStartOffset: newMediaStartOffset,
          })
        } else {
          const newDuration = Math.max(1, originalDuration + dragFrameDelta)
          updateElement(resizingId, { durationInFrames: newDuration })
        }
      }

      setDraggingId(null)
      setResizingId(null)
      setResizeHandle(null)
      setDragFrameDelta(0)
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [
    draggingId,
    resizingId,
    resizeHandle,
    dragStartX,
    originalStartFrame,
    originalDuration,
    originalMediaStartOffset,
    dragFrameDelta,
    template.durationInFrames,
    updateElement,
  ])

  // Measure timeline width for playhead positioning
  useEffect(() => {
    if (!timelineRef.current) return
    const updateWidth = () => {
      setTimelineWidth(timelineRef.current?.clientWidth || 0)
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  return (
    <div className="h-48 bg-[#161616] border-t border-border flex flex-col select-none">
      {/* Toolbar / Header */}
      <div className="px-4 py-2 border-b border-border text-xs text-text-secondary flex justify-between items-center bg-panel">
        <span className="font-medium uppercase tracking-wider text-[10px]">Timeline</span>
        <CurrentTime fps={template.fps} durationInFrames={template.durationInFrames} />
      </div>

      {/* Timeline Tracks Area */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-y-auto relative py-6 px-4 cursor-crosshair overflow-x-hidden custom-scrollbar"
        onMouseDown={handleScrub}
        onMouseMove={(e) => e.buttons === 1 && !draggingId && !resizingId && handleScrub(e)}
      >
        {/* Playhead Line */}
        <Playhead durationInFrames={template.durationInFrames} timelineWidth={timelineWidth} />

        {/* Tracks */}
        <div className="relative min-h-full">
          {template.elements.map((el) => (
            <TimelineClip
              key={el.id}
              el={el}
              durationInFrames={template.durationInFrames}
              selectedElementId={selectedElementId}
              draggingId={draggingId}
              resizingId={resizingId}
              resizeHandle={resizeHandle}
              originalStartFrame={originalStartFrame}
              originalDuration={originalDuration}
              dragFrameDelta={dragFrameDelta}
              onClipMouseDown={handleClipMouseDown}
              onResizeMouseDown={handleResizeMouseDown}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
