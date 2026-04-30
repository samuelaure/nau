import React from 'react'
import { useCurrentFrame, interpolate, OffthreadVideo, Loop } from 'remotion'

export interface BrandIdentity {
  primaryColor?: string
  secondaryColor?: string
  titleFont?: string
  bodyFont?: string
  overlayOpacity?: number
  logoUrl?: string
}

export interface ReelSlotProps {
  slots: Record<string, string>
  caption?: string
  hashtags?: string[]
  brollUrls?: string[]
  brand?: BrandIdentity
}

const DEFAULT_BRAND: Required<BrandIdentity> = {
  primaryColor: '#000000',
  secondaryColor: '#ffffff',
  titleFont: 'sans-serif',
  bodyFont: 'sans-serif',
  overlayOpacity: 0.55,
  logoUrl: '',
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function BrollBackground({ url, overlayOpacity }: { url?: string; overlayOpacity: number }) {
  if (!url) {
    return <div style={{ position: 'absolute', inset: 0, background: '#111' }} />
  }
  return (
    <>
      <Loop durationInFrames={300}>
        <OffthreadVideo
          src={url}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          muted
        />
      </Loop>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(0,0,0,${overlayOpacity})`,
        }}
      />
    </>
  )
}

function FadeText({
  text,
  fontSize,
  fontFamily,
  color,
  frameOffset = 0,
  maxWidth = 900,
}: {
  text: string
  fontSize: number
  fontFamily: string
  color: string
  frameOffset?: number
  maxWidth?: number
}) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame - frameOffset, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const translateY = interpolate(frame - frameOffset, [0, 20], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        fontFamily,
        fontSize,
        fontWeight: 700,
        color,
        textAlign: 'center',
        lineHeight: 1.2,
        maxWidth,
        padding: '0 60px',
        textShadow: '0 2px 20px rgba(0,0,0,0.8)',
        letterSpacing: '-0.5px',
      }}
    >
      {text}
    </div>
  )
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function Scene({
  brollUrl,
  text,
  fontSize,
  fontFamily,
  textColor,
  overlayOpacity,
  startFrame,
}: {
  brollUrl?: string
  text: string
  fontSize: number
  fontFamily: string
  textColor: string
  overlayOpacity: number
  startFrame: number
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <BrollBackground url={brollUrl} overlayOpacity={overlayOpacity} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FadeText
          text={text}
          fontSize={fontSize}
          fontFamily={fontFamily}
          color={textColor}
          frameOffset={startFrame}
        />
      </div>
    </div>
  )
}

function useSceneDisplay(startFrame: number, endFrame: number): boolean {
  const frame = useCurrentFrame()
  return frame >= startFrame && frame < endFrame
}

// ─── ReelT1 — Single Moment (~8s, 1 slot) ────────────────────────────────────
// durationInFrames: 240 (8s @ 30fps)

export function ReelT1({ slots, brollUrls = [], brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const broll = brollUrls[0]

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      <Scene
        brollUrl={broll}
        text={slots.text1 ?? ''}
        fontSize={100}
        fontFamily={b.titleFont}
        textColor={b.secondaryColor}
        overlayOpacity={b.overlayOpacity}
        startFrame={0}
      />
    </div>
  )
}

// ─── ReelT2 — Single Statement (~18s, 1 long slot) ───────────────────────────
// durationInFrames: 540 (18s @ 30fps)

export function ReelT2({ slots, brollUrls = [], brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const broll = brollUrls[0]

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      <Scene
        brollUrl={broll}
        text={slots.text1 ?? ''}
        fontSize={62}
        fontFamily={b.bodyFont}
        textColor={b.secondaryColor}
        overlayOpacity={b.overlayOpacity}
        startFrame={0}
      />
    </div>
  )
}

// ─── ReelT3 — Hook & Reveal (~15s, 2 slots) ──────────────────────────────────
// durationInFrames: 450 (15s @ 30fps)
// Scene 1: frames 0-149 (5s) — hook
// Scene 2: frames 150-449 (10s) — reveal

export function ReelT3({ slots, brollUrls = [], brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const frame = useCurrentFrame()

  const showScene1 = frame < 150
  const showScene2 = frame >= 150

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {showScene1 && (
        <Scene
          brollUrl={brollUrls[0]}
          text={slots.text1 ?? ''}
          fontSize={100}
          fontFamily={b.titleFont}
          textColor={b.secondaryColor}
          overlayOpacity={b.overlayOpacity}
          startFrame={0}
        />
      )}
      {showScene2 && (
        <Scene
          brollUrl={brollUrls[1] ?? brollUrls[0]}
          text={slots.text2 ?? ''}
          fontSize={72}
          fontFamily={b.bodyFont}
          textColor={b.secondaryColor}
          overlayOpacity={b.overlayOpacity}
          startFrame={150}
        />
      )}
    </div>
  )
}

// ─── ReelT4 — Arc (~18s, 3 slots) ────────────────────────────────────────────
// durationInFrames: 540 (18s @ 30fps)
// Scene 1: frames 0-149 (5s) — opening
// Scene 2: frames 150-389 (8s) — development
// Scene 3: frames 390-539 (5s) — landing

export function ReelT4({ slots, brollUrls = [], brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const frame = useCurrentFrame()

  const showScene1 = frame < 150
  const showScene2 = frame >= 150 && frame < 390
  const showScene3 = frame >= 390

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {showScene1 && (
        <Scene
          brollUrl={brollUrls[0]}
          text={slots.text1 ?? ''}
          fontSize={100}
          fontFamily={b.titleFont}
          textColor={b.secondaryColor}
          overlayOpacity={b.overlayOpacity}
          startFrame={0}
        />
      )}
      {showScene2 && (
        <Scene
          brollUrl={brollUrls[1] ?? brollUrls[0]}
          text={slots.text2 ?? ''}
          fontSize={72}
          fontFamily={b.bodyFont}
          textColor={b.secondaryColor}
          overlayOpacity={b.overlayOpacity}
          startFrame={150}
        />
      )}
      {showScene3 && (
        <Scene
          brollUrl={brollUrls[2] ?? brollUrls[0]}
          text={slots.text3 ?? ''}
          fontSize={100}
          fontFamily={b.titleFont}
          textColor={b.secondaryColor}
          overlayOpacity={b.overlayOpacity}
          startFrame={390}
        />
      )}
    </div>
  )
}
