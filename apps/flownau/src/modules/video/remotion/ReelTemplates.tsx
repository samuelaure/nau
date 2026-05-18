import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  useCurrentFrame,
  interpolate,
  OffthreadVideo,
  Loop,
  Sequence,
  Audio,
  delayRender,
  continueRender,
} from 'remotion'
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
// Modern sans-serif
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope'
import { loadFont as loadUrbanist } from '@remotion/google-fonts/Urbanist'
import { loadFont as loadOutfit } from '@remotion/google-fonts/Outfit'
import { loadFont as loadFigtree } from '@remotion/google-fonts/Figtree'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadSora } from '@remotion/google-fonts/Sora'
import { loadFont as loadLato } from '@remotion/google-fonts/Lato'
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto'
import { loadFont as loadWorkSans } from '@remotion/google-fonts/WorkSans'
import { loadFont as loadBarlow } from '@remotion/google-fonts/Barlow'
import { loadFont as loadKanit } from '@remotion/google-fonts/Kanit'
// Serif
import { loadFont as loadMerriweather } from '@remotion/google-fonts/Merriweather'
import { loadFont as loadLora } from '@remotion/google-fonts/Lora'
import { loadFont as loadCormorant } from '@remotion/google-fonts/Cormorant'
import { loadFont as loadLibreBaskerville } from '@remotion/google-fonts/LibreBaskerville'
import { loadFont as loadCrimsonText } from '@remotion/google-fonts/CrimsonText'
import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel'
// Bold display
import { loadFont as loadTeko } from '@remotion/google-fonts/Teko'
import { loadFont as loadRighteous } from '@remotion/google-fonts/Righteous'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { loadFont as loadBarlowCondensed } from '@remotion/google-fonts/BarlowCondensed'
// Handwriting / script
import { loadFont as loadDancingScript } from '@remotion/google-fonts/DancingScript'
import { loadFont as loadSacramento } from '@remotion/google-fonts/Sacramento'
import { loadFont as loadSatisfy } from '@remotion/google-fonts/Satisfy'
import { loadFont as loadPacifico } from '@remotion/google-fonts/Pacifico'
import { loadFont as loadCaveat } from '@remotion/google-fonts/Caveat'

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
  // Modern sans-serif
  loadManrope(),
  loadUrbanist(),
  loadOutfit(),
  loadFigtree(),
  loadSpaceGrotesk(),
  loadSora(),
  loadLato(),
  loadRoboto(),
  loadWorkSans(),
  loadBarlow(),
  loadKanit(),
  // Serif
  loadMerriweather(),
  loadLora(),
  loadCormorant(),
  loadLibreBaskerville(),
  loadCrimsonText(),
  loadCinzel(),
  // Bold display
  loadTeko(),
  loadRighteous(),
  loadArchivoBlack(),
  loadBarlowCondensed(),
  // Handwriting / script
  loadDancingScript(),
  loadSacramento(),
  loadSatisfy(),
  loadPacifico(),
  loadCaveat(),
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
  durationInFrames?: number
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

const SCENE_SHORT = 75 // 2.5s  — single-text templates
const SCENE_HOOK = 75 // 2.5s  — hook scene in multi-text
const SCENE_BODY = 120 // 4s    — body / development scene
const SCENE_LAND = 90 // 3s    — landing / reveal scene
const TRAIL = 45 // 1.5s  — silent buffer after last text

// Worst-case scene duration — used by render-worker to ensure enough clip headroom.
export const BROLL_REQUIRED_FRAMES = SCENE_BODY + TRAIL

// ── Safe zone ─────────────────────────────────────────────────────────────────
// Platform UI (navigation bar, caption/action tray) covers the edges of a reel.
// All text must stay inside this zone.

const SAFE_ZONE = { top: 220, bottom: 450, left: 160, right: 160 } as const
const SAFE_W = 1080 - SAFE_ZONE.left - SAFE_ZONE.right // 760
const SAFE_H = 1920 - SAFE_ZONE.top - SAFE_ZONE.bottom // 1250

// TextZone: centers text on the full 1920px canvas height so text appears
// visually centered on screen. Horizontal safe margins are still respected.
// The text block itself is bounded to SAFE_H so it can't overflow into UI areas.
// align="top"    — anchored to safe zone top edge (padding applied)
// align="bottom" — anchored to safe zone bottom edge (padding applied)
function TextZone({
  children,
  align = 'center',
}: {
  children: React.ReactNode
  align?: 'top' | 'center' | 'bottom'
}) {
  if (align === 'top') {
    return (
      <div
        style={{
          position: 'absolute',
          top: SAFE_ZONE.top,
          left: SAFE_ZONE.left,
          width: SAFE_W,
          height: SAFE_H,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        {children}
      </div>
    )
  }
  if (align === 'bottom') {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: SAFE_ZONE.bottom,
          left: SAFE_ZONE.left,
          width: SAFE_W,
          height: SAFE_H,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {children}
      </div>
    )
  }
  // center: span full canvas height so text is centered on the whole frame,
  // not on the asymmetric safe zone (bottom padding is 2× the top).
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: SAFE_ZONE.left,
        width: SAFE_W,
        height: 1920,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  )
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function BrollBackground({ clip, overlayOpacity }: { clip?: BrollClip; overlayOpacity: number }) {
  if (!clip?.url) {
    return <div style={{ position: 'absolute', inset: 0, background: '#111' }} />
  }
  const startFrom = clip.startFrom ?? 0
  const clipFrames = clip.durationInFrames
  return (
    <>
      <Loop durationInFrames={clipFrames || 9999}>
        <OffthreadVideo
          src={clip.url}
          startFrom={startFrom}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          muted
        />
      </Loop>
      <div
        style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }}
      />
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
    : interpolate(frame - frameOffset, [0, 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
  const translateY = instant
    ? 0
    : interpolate(frame - frameOffset, [0, 12], [15, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })

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
          whiteSpace: 'pre-wrap',
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
// Layout: [text1 · 4s — full duration, never disappears]  = 4s / 120f

export function ReelT1({ slots, brollClips = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {audioUrl && <Audio src={audioUrl} />}
      <BrollBackground clip={brollClips[0]} overlayOpacity={b.overlayOpacity} />
      <TextZone>
        <FitText
          text={slots.text1 ?? ''}
          baseFontSize={100}
          maxTextSize={b.maxTextSize}
          fontFamily={b.titleFont}
          color={b.secondaryColor}
          boxWidth={SAFE_W}
          boxHeight={SAFE_H}
          frameOffset={0}
          instant
        />
      </TextZone>
    </div>
  )
}

// ─── ReelT2 — Single Statement ────────────────────────────────────────────────
// Layout: [text1 · 9s — full duration, never disappears]  = 9s / 270f

export function ReelT2({ slots, brollClips = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {audioUrl && <Audio src={audioUrl} />}
      <BrollBackground clip={brollClips[0]} overlayOpacity={b.overlayOpacity} />
      <TextZone>
        <FitText
          text={slots.text1 ?? ''}
          baseFontSize={62}
          maxTextSize={b.maxTextSize}
          fontFamily={b.bodyFont}
          color={b.secondaryColor}
          boxWidth={SAFE_W}
          boxHeight={SAFE_H}
          frameOffset={0}
          instant
        />
      </TextZone>
    </div>
  )
}

// ─── ReelT3 — Hook & Reveal ───────────────────────────────────────────────────
// Layout: [hook · 2.5s] [reveal · 3.5s, text until end]  = 6s / 180f

const T3_S2 = SCENE_HOOK // 75 — reveal starts here
const T3_REVEAL = 105 // 3.5s — reveal scene duration

export function ReelT3({ slots, brollClips = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const clip1 = brollClips[0]
  const clip2 = brollClips[1] ?? brollClips[0]

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {audioUrl && <Audio src={audioUrl} />}
      <Sequence from={0} durationInFrames={T3_S2}>
        <BrollBackground clip={clip1} overlayOpacity={b.overlayOpacity} />
        <TextZone>
          <FitText
            text={slots.text1 ?? ''}
            baseFontSize={100}
            maxTextSize={b.maxTextSize}
            fontFamily={b.titleFont}
            color={b.secondaryColor}
            boxWidth={SAFE_W}
            boxHeight={SAFE_H}
            frameOffset={0}
            instant
          />
        </TextZone>
      </Sequence>
      <Sequence from={T3_S2} durationInFrames={T3_REVEAL}>
        <BrollBackground clip={clip2} overlayOpacity={b.overlayOpacity} />
        <TextZone>
          <FitText
            text={slots.text2 ?? ''}
            baseFontSize={72}
            maxTextSize={b.maxTextSize}
            fontFamily={b.bodyFont}
            color={b.secondaryColor}
            boxWidth={SAFE_W}
            boxHeight={SAFE_H}
            frameOffset={0}
          />
        </TextZone>
      </Sequence>
    </div>
  )
}

// ─── ReelT4 — Arc ─────────────────────────────────────────────────────────────
// Layout: [opening · 2.5s] [development · 4s] [landing · 5.5s, text until end]  = 12s / 360f

const T4_S2 = SCENE_HOOK // 75  — development starts
const T4_S3 = SCENE_HOOK + SCENE_BODY // 195 — landing starts
const T4_LAND = 165 // 5.5s — landing scene duration

export function ReelT4({ slots, brollClips = [], audioUrl, brand = {} }: ReelSlotProps) {
  const b = { ...DEFAULT_BRAND, ...brand }
  const clip1 = brollClips[0]
  const clip2 = brollClips[1] ?? brollClips[0]
  const clip3 = brollClips[2] ?? brollClips[1] ?? brollClips[0]

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {audioUrl && <Audio src={audioUrl} />}
      <Sequence from={0} durationInFrames={T4_S2}>
        <BrollBackground clip={clip1} overlayOpacity={b.overlayOpacity} />
        <TextZone>
          <FitText
            text={slots.text1 ?? ''}
            baseFontSize={100}
            maxTextSize={b.maxTextSize}
            fontFamily={b.titleFont}
            color={b.secondaryColor}
            boxWidth={SAFE_W}
            boxHeight={SAFE_H}
            frameOffset={0}
            instant
          />
        </TextZone>
      </Sequence>
      <Sequence from={T4_S2} durationInFrames={SCENE_BODY}>
        <BrollBackground clip={clip2} overlayOpacity={b.overlayOpacity} />
        <TextZone>
          <FitText
            text={slots.text2 ?? ''}
            baseFontSize={72}
            maxTextSize={b.maxTextSize}
            fontFamily={b.bodyFont}
            color={b.secondaryColor}
            boxWidth={SAFE_W}
            boxHeight={SAFE_H}
            frameOffset={0}
          />
        </TextZone>
      </Sequence>
      <Sequence from={T4_S3} durationInFrames={T4_LAND}>
        <BrollBackground clip={clip3} overlayOpacity={b.overlayOpacity} />
        <TextZone>
          <FitText
            text={slots.text3 ?? ''}
            baseFontSize={100}
            maxTextSize={b.maxTextSize}
            fontFamily={b.titleFont}
            color={b.secondaryColor}
            boxWidth={SAFE_W}
            boxHeight={SAFE_H}
            frameOffset={0}
          />
        </TextZone>
      </Sequence>
    </div>
  )
}
