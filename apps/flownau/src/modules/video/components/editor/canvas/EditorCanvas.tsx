'use client'

import React, { useEffect, useRef } from 'react'
import { Player, PlayerRef } from '@remotion/player'
import { useEditorStore } from '@/modules/video/store/useEditorStore'
import { usePlaybackStore } from '@/modules/video/store/usePlaybackStore'
import { UniversalComposition } from '@/modules/video/remotion/UniversalComposition'
import { TransformOverlay } from './TransformOverlay'

export function EditorCanvas() {
  const template = useEditorStore((state) => state.template)
  const setSelectedElementId = useEditorStore((state) => state.setSelectedElementId)

  const currentFrame = usePlaybackStore((state) => state.currentFrame)
  const setCurrentFrame = usePlaybackStore((state) => state.setCurrentFrame)
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  const setIsPlaying = usePlaybackStore((state) => state.setIsPlaying)

  const playerRef = useRef<PlayerRef>(null)
  const isUpdatingFromPlayer = useRef(false)

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

  // TODO: Calculation for responsive scaling/fit
  const containerWidth = 360
  const containerHeight = 640

  return (
    <div
      onClick={() => setSelectedElementId(null)}
      className="flex-1 bg-background select-none flex items-center justify-center relative p-10 overflow-hidden bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:32px_32px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-black shadow-[0_30px_100px_rgba(0,0,0,0.8)] border border-white/5 ring-1 ring-white/5 scale-[0.85] origin-center"
        style={{
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
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
          controls
          clickToPlay={false}
        />
        <TransformOverlay containerWidth={containerWidth} containerHeight={containerHeight} />
      </div>

      {/* View Controls Helper (Zoom etc) - Placeholder */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-panel/80 backdrop-blur-md border border-white/5 px-4 py-2 rounded-2xl text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] shadow-2xl">
        Canvas 85%
      </div>
    </div>
  )
}
