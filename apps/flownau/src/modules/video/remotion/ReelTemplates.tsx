import React from 'react'
import { useCurrentFrame, interpolate, OffthreadVideo, Sequence, Audio } from 'remotion'

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
  audioUrl?: string
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
      <OffthreadVideo
        src={url}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        muted
        playbackRate={1}
      />
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

// ─── ReelT1 — Single Moment ───────────────────────────────────────────────────
// Layout: [text1 · 2.5s] [trail · 1.5s]  = 4s / 120f

export function ReelT1({ slots, brollUrls = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {audioUrl && <Audio src={audioUrl} />}
      <BrollBackground url={brollUrls[0]} overlayOpacity={b.overlayOpacity} />
      <Sequence from={0} durationInFrames={SCENE_SHORT}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FadeText
            text={slots.text1 ?? ''}
            fontSize={100}
            fontFamily={b.titleFont}
            color={b.secondaryColor}
            frameOffset={0}
            instant
          />
        </div>
      </Sequence>
    </div>
  )
}

// ─── ReelT2 — Single Statement ────────────────────────────────────────────────
// Layout: [text1 · 5s] [trail · 1.5s]  = 6.5s / 195f

export function ReelT2({ slots, brollUrls = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const BODY = 150

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {audioUrl && <Audio src={audioUrl} />}
      <BrollBackground url={brollUrls[0]} overlayOpacity={b.overlayOpacity} />
      <Sequence from={0} durationInFrames={BODY}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FadeText
            text={slots.text1 ?? ''}
            fontSize={62}
            fontFamily={b.bodyFont}
            color={b.secondaryColor}
            frameOffset={0}
            instant
          />
        </div>
      </Sequence>
    </div>
  )
}

// ─── ReelT3 — Hook & Reveal ───────────────────────────────────────────────────
// Layout: [hook · 2.5s] [reveal · 4s] [trail · 1.5s]  = 8s / 240f

const T3_S2 = SCENE_HOOK                    // 75
const T3_END = SCENE_HOOK + SCENE_BODY      // 195

export function ReelT3({ slots, brollUrls = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const broll1 = brollUrls[0]
  const broll2 = brollUrls[1] ?? brollUrls[0]

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {audioUrl && <Audio src={audioUrl} />}
      {/* Scene 1: hook — broll1 + text1 */}
      <Sequence from={0} durationInFrames={T3_S2}>
        <BrollBackground url={broll1} overlayOpacity={b.overlayOpacity} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FadeText text={slots.text1 ?? ''} fontSize={100} fontFamily={b.titleFont} color={b.secondaryColor} frameOffset={0} instant />
        </div>
      </Sequence>
      {/* Scene 2: reveal — broll2 spans body + trail, text2 only during body */}
      <Sequence from={T3_S2} durationInFrames={SCENE_BODY + TRAIL}>
        <BrollBackground url={broll2} overlayOpacity={b.overlayOpacity} />
        <Sequence from={0} durationInFrames={SCENE_BODY}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FadeText text={slots.text2 ?? ''} fontSize={72} fontFamily={b.bodyFont} color={b.secondaryColor} frameOffset={0} />
          </div>
        </Sequence>
      </Sequence>
    </div>
  )
}

// ─── ReelT4 — Arc ─────────────────────────────────────────────────────────────
// Layout: [opening · 2.5s] [development · 4s] [landing · 3s] [trail · 1.5s] = 11s / 330f

const T4_S2  = SCENE_HOOK                             // 75
const T4_S3  = SCENE_HOOK + SCENE_BODY                // 195
const T4_END = SCENE_HOOK + SCENE_BODY + SCENE_LAND   // 285

export function ReelT4({ slots, brollUrls = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const broll1 = brollUrls[0]
  const broll2 = brollUrls[1] ?? brollUrls[0]
  const broll3 = brollUrls[2] ?? brollUrls[1] ?? brollUrls[0]

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {audioUrl && <Audio src={audioUrl} />}
      {/* Scene 1: opening — broll1 + text1 */}
      <Sequence from={0} durationInFrames={T4_S2}>
        <BrollBackground url={broll1} overlayOpacity={b.overlayOpacity} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FadeText text={slots.text1 ?? ''} fontSize={100} fontFamily={b.titleFont} color={b.secondaryColor} frameOffset={0} instant />
        </div>
      </Sequence>
      {/* Scene 2: development — broll2 + text2 */}
      <Sequence from={T4_S2} durationInFrames={SCENE_BODY}>
        <BrollBackground url={broll2} overlayOpacity={b.overlayOpacity} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FadeText text={slots.text2 ?? ''} fontSize={72} fontFamily={b.bodyFont} color={b.secondaryColor} frameOffset={0} />
        </div>
      </Sequence>
      {/* Scene 3: landing — broll3 spans land + trail, text3 only during land */}
      <Sequence from={T4_S3} durationInFrames={SCENE_LAND + TRAIL}>
        <BrollBackground url={broll3} overlayOpacity={b.overlayOpacity} />
        <Sequence from={0} durationInFrames={SCENE_LAND}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FadeText text={slots.text3 ?? ''} fontSize={100} fontFamily={b.titleFont} color={b.secondaryColor} frameOffset={0} />
          </div>
        </Sequence>
      </Sequence>
    </div>
  )
}
