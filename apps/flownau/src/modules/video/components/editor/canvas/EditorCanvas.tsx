'use client'

import React, { useEffect, useRef } from 'react'
import { Player, PlayerRef } from '@remotion/player'
import { useEditorStore } from '@/modules/video/store/useEditorStore'
import { usePlaybackStore } from '@/modules/video/store/usePlaybackStore'
import { useCanvasStore } from '@/modules/video/store/useCanvasStore'
import { UniversalComposition } from '@/modules/video/remotion/UniversalComposition'
import { TransformOverlay } from './TransformOverlay'
import { ZoomIn, ZoomOut, Maximize, MousePointer2 } from 'lucide-react'
import { Tooltip } from '@/modules/video/components/ui/Tooltip'

export function EditorCanvas() {
  const template = useEditorStore((state) => state.template)
  const setSelectedElementId = useEditorStore((state) => state.setSelectedElementId)

  const currentFrame = usePlaybackStore((state) => state.currentFrame)
  const setCurrentFrame = usePlaybackStore((state) => state.setCurrentFrame)
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  const setIsPlaying = usePlaybackStore((state) => state.setIsPlaying)

  const playerRef = useRef<PlayerRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isUpdatingFromPlayer = useRef(false)

  const zoom = useCanvasStore((state) => state.zoom)
  const setZoom = useCanvasStore((state) => state.setZoom)
  const [fitScale, setFitScale] = React.useState(1)
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })

  // Sync Store -> Player (seeking)
  useEffect(() => {
    if (!playerRef.current) return
    if (isUpdatingFromPlayer.current) {
      isUpdatingFromPlayer.current = false
      return
    }

    const playerFrame = playerRef.current.getCurrentFrame()
    if (Math.abs(playerFrame - currentFrame) > 1) {
      playerRef.current.seekTo(currentFrame)
    }
  }, [currentFrame])

  // Sync Store -> Player (Play/Pause)
  useEffect(() => {
    if (!playerRef.current) return
    const playerIsPlaying = playerRef.current.isPlaying()
    if (isPlaying && !playerIsPlaying) {
      playerRef.current.play()
    } else if (!isPlaying && playerIsPlaying) {
      playerRef.current.pause()
    }
  }, [isPlaying])

  // Event Listeners for Player -> Store sync
  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      isUpdatingFromPlayer.current = true
      setCurrentFrame(e.detail.frame)
    }

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onSeeked = (e: { detail: { frame: number } }) => {
      isUpdatingFromPlayer.current = true
      setCurrentFrame(e.detail.frame)
    }

    player.addEventListener('frameupdate', onFrameUpdate)
    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
    player.addEventListener('seeked', onSeeked)

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate)
      player.removeEventListener('play', onPlay)
      player.removeEventListener('pause', onPause)
      player.removeEventListener('seeked', onSeeked)
    }
  }, [setCurrentFrame, setIsPlaying])

  // Responsive Scaling Logic
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width === 0 || height === 0) return

      const padding = 80
      const availableWidth = width - padding
      const availableHeight = height - padding

      const scaleX = availableWidth / template.width
      const scaleY = availableHeight / template.height
      const newFitScale = Math.min(scaleX, scaleY)

      setFitScale(newFitScale)
      setContainerSize({ width, height })
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [template.width, template.height])

  const totalScale = fitScale * zoom
  const currentWidth = template.width * totalScale
  const currentHeight = template.height * totalScale
  return (
    <div
      ref={containerRef}
      onClick={() => setSelectedElementId(null)}
      className="flex-1 bg-background select-none flex items-center justify-center relative overflow-hidden bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:32px_32px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-black shadow-[0_30px_100px_rgba(0,0,0,0.8)] border border-white/5 ring-1 ring-white/5 origin-center transition-transform duration-300 ease-out"
        style={{
          width: `${currentWidth}px`,
          height: `${currentHeight}px`,
        }}
      >
        <Player
          ref={playerRef}
          component={UniversalComposition}
          inputProps={{ template }}
          durationInFrames={Math.max(1, template.durationInFrames)}
          fps={template.fps}
          compositionWidth={template.width}
          compositionHeight={template.height}
          className="w-full h-full"
          clickToPlay={false}
        />
        <TransformOverlay containerWidth={currentWidth} containerHeight={currentHeight} />
      </div>

      {/* View Controls Helper (Zoom etc) */}
      <div className="absolute bottom-6 right-6 flex items-center gap-1.5 bg-panel/80 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl shadow-2xl z-30">
        <Tooltip content="Zoom Out">
          <button
            onClick={() => setZoom(zoom - 0.1)}
            className="p-2 hover:bg-white/5 rounded-xl text-text-secondary hover:text-white transition-colors"
          >
            <ZoomOut size={16} />
          </button>
        </Tooltip>

        <button
          onClick={() => setZoom(1)}
          className="px-3 py-1.5 hover:bg-white/5 rounded-xl text-[10px] font-bold text-text-secondary hover:text-white transition-colors uppercase tracking-wider"
        >
          {Math.round(zoom * 100)}%
        </button>

        <Tooltip content="Zoom In">
          <button
            onClick={() => setZoom(zoom + 0.1)}
            className="p-2 hover:bg-white/5 rounded-xl text-text-secondary hover:text-white transition-colors"
          >
            <ZoomIn size={16} />
          </button>
        </Tooltip>

        <div className="w-px h-4 bg-white/10 mx-1" />

        <Tooltip content="Fit to Screen">
          <button
            onClick={() => setZoom(1)} // In this context zoom 1 is fit because fitScale is separate
            className="p-2 hover:bg-white/5 rounded-xl text-text-secondary hover:text-white transition-colors"
          >
            <Maximize size={16} />
          </button>
        </Tooltip>
      </div>

      {/* Pan helper (future) */}
      <div className="absolute bottom-6 left-6 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">
        {template.width} x {template.height} @ {template.fps}fps
      </div>
    </div>
  )
}
