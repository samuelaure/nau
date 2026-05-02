import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useCurrentFrame, interpolate, OffthreadVideo, Sequence, Audio, delayRender, continueRender } from 'remotion'
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton'
import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue'
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins'
import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans'
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito'
import { loadFont as loadRaleway } from '@remotion/google-fonts/Raleway'
import { loadFont as loadPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as loadBlackHanSans } from '@remotion/google-fonts/BlackHanSans'

// Pre-load all supported fonts so Remotion can wait for them before rendering.
// Each loadFont() returns a handle; we delay rendering until all resolve.
const fontLoaders = [
  loadAnton(),
  loadBebasNeue(),
  loadOswald(),
  loadInter(),
  loadMontserrat(),
  loadPoppins(),
  loadDMSans(),
  loadNunito(),
  loadRaleway(),
  loadPlayfairDisplay(),
  loadBlackHanSans(),
]

export interface BrandIdentity {
  primaryColor?: string
  secondaryColor?: string
  titleFont?: string
  bodyFont?: string
  overlayOpacity?: number
  logoUrl?: string
  maxTextSize?: number
}

export interface BrollClip {
  url: string
  startFrom?: number
}

export interface ReelSlotProps {
  slots: Record<string, string>
  caption?: string
  hashtags?: string[]
  brollClips?: BrollClip[]
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
  maxTextSize: 100,
}

export const REMOTION_FPS = 30

const SCENE_SHORT  = 75   // 2.5s  — single-text templates
const SCENE_HOOK   = 75   // 2.5s  — hook scene in multi-text
const SCENE_BODY   = 120  // 4s    — body / development scene
const SCENE_LAND   = 90   // 3s    — landing / reveal scene
const TRAIL        = 45   // 1.5s  — silent buffer after last text

// Worst-case scene duration — used by render-worker to ensure enough clip headroom.
export const BROLL_REQUIRED_FRAMES = SCENE_BODY + TRAIL

// ── Shared primitives ──────────────────────────────────────────────────────────

function BrollBackground({ clip, overlayOpacity }: { clip?: BrollClip; overlayOpacity: number }) {
  if (!clip?.url) {
    return <div style={{ position: 'absolute', inset: 0, background: '#111' }} />
  }
  return (
    <>
      <OffthreadVideo
        src={clip.url}
        startFrom={clip.startFrom ?? 0}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        muted
      />
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
    </>
  )
}

// ── FitText ───────────────────────────────────────────────────────────────────
// Renders text inside a fixed bounding box. If the text overflows, font size is
// reduced in steps until it fits. This mirrors the "text block" behaviour in
// design tools: the area is fixed, the type scales down to fill it completely.

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function FitText({
  text,
  baseFontSize,
  maxTextSize = 100,
  fontFamily,
  color,
  boxWidth,
  boxHeight,
  frameOffset = 0,
  instant = false,
}: {
  text: string
  baseFontSize: number
  maxTextSize?: number
  fontFamily: string
  color: string
  boxWidth: number
  boxHeight: number
  frameOffset?: number
  instant?: boolean
}) {
  const frame = useCurrentFrame()
  const containerRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(() => Math.round(baseFontSize * (maxTextSize / 100)))

  // Remotion font-load delay handle — ensures fonts are loaded before frame 0.
  const [handle] = useState(() => delayRender('FitText font load'))

  useEffect(() => {
    Promise.all(fontLoaders).then(() => continueRender(handle))
  }, [handle])

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const target = Math.round(baseFontSize * (maxTextSize / 100))
    let size = target
    el.style.fontSize = `${size}px`

    // Binary-search downward until text fits within the bounding box.
    while ((el.scrollHeight > boxHeight || el.scrollWidth > boxWidth) && size > 12) {
      size -= 2
      el.style.fontSize = `${size}px`
    }
    setFontSize(size)
  }, [text, baseFontSize, maxTextSize, fontFamily, boxWidth, boxHeight])

  const opacity = instant
    ? 1
    : interpolate(frame - frameOffset, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const translateY = instant
    ? 0
    : interpolate(frame - frameOffset, [0, 12], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        width: boxWidth,
        height: boxHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        ref={containerRef}
        style={{
          fontFamily,
          fontSize,
          fontWeight: 700,
          color,
          textAlign: 'center',
          lineHeight: 1.2,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          textShadow: '0 2px 20px rgba(0,0,0,0.8)',
          letterSpacing: '-0.5px',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {text}
      </div>
    </div>
  )
}

// ─── ReelT1 — Single Moment ───────────────────────────────────────────────────
// Layout: [text1 · 2.5s] [trail · 1.5s]  = 4s / 120f

export function ReelT1({ slots, brollClips = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {audioUrl && <Audio src={audioUrl} />}
      <BrollBackground clip={brollClips[0]} overlayOpacity={b.overlayOpacity} />
      <Sequence from={0} durationInFrames={SCENE_SHORT}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FitText
            text={slots.text1 ?? ''}
            baseFontSize={100}
            maxTextSize={b.maxTextSize}
            fontFamily={b.titleFont}
            color={b.secondaryColor}
            boxWidth={960}
            boxHeight={700}
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

export function ReelT2({ slots, brollClips = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const BODY = 150

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {audioUrl && <Audio src={audioUrl} />}
      <BrollBackground clip={brollClips[0]} overlayOpacity={b.overlayOpacity} />
      <Sequence from={0} durationInFrames={BODY}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FitText
            text={slots.text1 ?? ''}
            baseFontSize={62}
            maxTextSize={b.maxTextSize}
            fontFamily={b.bodyFont}
            color={b.secondaryColor}
            boxWidth={960}
            boxHeight={900}
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

export function ReelT3({ slots, brollClips = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const clip1 = brollClips[0]
  const clip2 = brollClips[1] ?? brollClips[0]

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {audioUrl && <Audio src={audioUrl} />}
      <Sequence from={0} durationInFrames={T3_S2}>
        <BrollBackground clip={clip1} overlayOpacity={b.overlayOpacity} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FitText text={slots.text1 ?? ''} baseFontSize={100} maxTextSize={b.maxTextSize} fontFamily={b.titleFont} color={b.secondaryColor} boxWidth={960} boxHeight={700} frameOffset={0} instant />
        </div>
      </Sequence>
      <Sequence from={T3_S2} durationInFrames={SCENE_BODY + TRAIL}>
        <BrollBackground clip={clip2} overlayOpacity={b.overlayOpacity} />
        <Sequence from={0} durationInFrames={SCENE_BODY}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FitText text={slots.text2 ?? ''} baseFontSize={72} maxTextSize={b.maxTextSize} fontFamily={b.bodyFont} color={b.secondaryColor} boxWidth={960} boxHeight={900} frameOffset={0} />
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

export function ReelT4({ slots, brollClips = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const clip1 = brollClips[0]
  const clip2 = brollClips[1] ?? brollClips[0]
  const clip3 = brollClips[2] ?? brollClips[1] ?? brollClips[0]

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', position: 'relative', overflow: 'hidden' }}>
      {audioUrl && <Audio src={audioUrl} />}
      <Sequence from={0} durationInFrames={T4_S2}>
        <BrollBackground clip={clip1} overlayOpacity={b.overlayOpacity} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FitText text={slots.text1 ?? ''} baseFontSize={100} maxTextSize={b.maxTextSize} fontFamily={b.titleFont} color={b.secondaryColor} boxWidth={960} boxHeight={700} frameOffset={0} instant />
        </div>
      </Sequence>
      <Sequence from={T4_S2} durationInFrames={SCENE_BODY}>
        <BrollBackground clip={clip2} overlayOpacity={b.overlayOpacity} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FitText text={slots.text2 ?? ''} baseFontSize={72} maxTextSize={b.maxTextSize} fontFamily={b.bodyFont} color={b.secondaryColor} boxWidth={960} boxHeight={900} frameOffset={0} />
        </div>
      </Sequence>
      <Sequence from={T4_S3} durationInFrames={SCENE_LAND + TRAIL}>
        <BrollBackground clip={clip3} overlayOpacity={b.overlayOpacity} />
        <Sequence from={0} durationInFrames={SCENE_LAND}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FitText text={slots.text3 ?? ''} baseFontSize={100} maxTextSize={b.maxTextSize} fontFamily={b.titleFont} color={b.secondaryColor} boxWidth={960} boxHeight={700} frameOffset={0} />
          </div>
        </Sequence>
      </Sequence>
    </div>
  )
}
