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

// ── SM attention-span timing ───────────────────────────────────────────────────
// Each scene occupies equal time so rhythm feels consistent.
// A trailing buffer after the last text lets viewers finish reading before cut.
// All durations at 30fps.

const SCENE_SHORT  = 75   // 2.5s  — single-text templates
const SCENE_HOOK   = 75   // 2.5s  — hook scene in multi-text
const SCENE_BODY   = 120  // 4s    — body / development scene
const SCENE_LAND   = 90   // 3s    — landing / reveal scene
const TRAIL        = 45   // 1.5s  — silent buffer after last text

// ── Shared primitives ──────────────────────────────────────────────────────────

function BrollBackground({ url, overlayOpacity }: { url?: string; overlayOpacity: number }) {
  if (!url) {
    return <div style={{ position: 'absolute', inset: 0, background: '#111' }} />
  }
  return (
    <>
      <Loop durationInFrames={180}>
        <OffthreadVideo
          src={url}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          muted
        />
      </Loop>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
    </>
  )
}

function FadeText({
  text,
  fontSize,
  fontFamily,
  color,
  frameOffset = 0,
  instant = false,
}: {
  text: string
  fontSize: number
  fontFamily: string
  color: string
  frameOffset?: number
  instant?: boolean   // skip fade — used for frame-0 scenes so thumbnail has visible text
}) {
  const frame = useCurrentFrame()
  const opacity = instant
    ? 1
    : interpolate(frame - frameOffset, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const translateY = instant
    ? 0
    : interpolate(frame - frameOffset, [0, 12], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

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
        maxWidth: 900,
        padding: '0 60px',
        textShadow: '0 2px 20px rgba(0,0,0,0.8)',
        letterSpacing: '-0.5px',
      }}
    >
      {text}
    </div>
  )
}

function Scene({
  brollUrl,
  text,
  fontSize,
  fontFamily,
  textColor,
  overlayOpacity,
  frameOffset,
  instant = false,
}: {
  brollUrl?: string
  text: string
  fontSize: number
  fontFamily: string
  textColor: string
  overlayOpacity: number
  frameOffset: number
  instant?: boolean
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
          frameOffset={frameOffset}
          instant={instant}
        />
      </div>
    </div>
  )
}

// ─── ReelT1 — Single Moment ───────────────────────────────────────────────────
// Layout: [text1 · 2.5s] [trail · 1.5s]  = 4s / 120f

export function ReelT1({ slots, brollUrls = [], brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const frame = useCurrentFrame()
  const showText = frame < SCENE_SHORT

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      <BrollBackground url={brollUrls[0]} overlayOpacity={b.overlayOpacity} />
      {showText && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FadeText
              text={slots.text1 ?? ''}
              fontSize={100}
              fontFamily={b.titleFont}
              color={b.secondaryColor}
              frameOffset={0}
              instant
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ReelT2 — Single Statement ────────────────────────────────────────────────
// Layout: [text1 · 5s] [trail · 1.5s]  = 6.5s / 195f

export function ReelT2({ slots, brollUrls = [], brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const frame = useCurrentFrame()
  const BODY = 150
  const showText = frame < BODY

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      <BrollBackground url={brollUrls[0]} overlayOpacity={b.overlayOpacity} />
      {showText && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FadeText
              text={slots.text1 ?? ''}
              fontSize={62}
              fontFamily={b.bodyFont}
              color={b.secondaryColor}
              frameOffset={0}
              instant
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ReelT3 — Hook & Reveal ───────────────────────────────────────────────────
// Layout: [hook · 2.5s] [reveal · 4s] [trail · 1.5s]  = 8s / 240f

const T3_S2 = SCENE_HOOK                    // 75
const T3_END = SCENE_HOOK + SCENE_BODY      // 195

export function ReelT3({ slots, brollUrls = [], brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const frame = useCurrentFrame()

  const showScene1 = frame < T3_S2
  const showScene2 = frame >= T3_S2 && frame < T3_END

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
          frameOffset={0}
          instant
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
          frameOffset={T3_S2}
        />
      )}
      {!showScene1 && !showScene2 && (
        <BrollBackground url={brollUrls[1] ?? brollUrls[0]} overlayOpacity={b.overlayOpacity} />
      )}
    </div>
  )
}

// ─── ReelT4 — Arc ─────────────────────────────────────────────────────────────
// Layout: [opening · 2.5s] [development · 4s] [landing · 3s] [trail · 1.5s] = 11s / 330f

const T4_S2  = SCENE_HOOK                             // 75
const T4_S3  = SCENE_HOOK + SCENE_BODY                // 195
const T4_END = SCENE_HOOK + SCENE_BODY + SCENE_LAND   // 285

export function ReelT4({ slots, brollUrls = [], brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const frame = useCurrentFrame()

  const showScene1 = frame < T4_S2
  const showScene2 = frame >= T4_S2 && frame < T4_S3
  const showScene3 = frame >= T4_S3 && frame < T4_END

  const trailBroll = brollUrls[2] ?? brollUrls[1] ?? brollUrls[0]

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
          frameOffset={0}
          instant
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
          frameOffset={T4_S2}
        />
      )}
      {showScene3 && (
        <Scene
          brollUrl={trailBroll}
          text={slots.text3 ?? ''}
          fontSize={100}
          fontFamily={b.titleFont}
          textColor={b.secondaryColor}
          overlayOpacity={b.overlayOpacity}
          frameOffset={T4_S3}
        />
      )}
      {/* Trailing buffer — b-roll continues, no text */}
      {!showScene1 && !showScene2 && !showScene3 && (
        <BrollBackground url={trailBroll} overlayOpacity={b.overlayOpacity} />
      )}
    </div>
  )
}
