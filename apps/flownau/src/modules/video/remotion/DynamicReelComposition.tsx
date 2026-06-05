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
  AbsoluteFill,
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
import { loadFont as loadMerriweather } from '@remotion/google-fonts/Merriweather'
import { loadFont as loadLora } from '@remotion/google-fonts/Lora'
import { loadFont as loadCormorant } from '@remotion/google-fonts/Cormorant'
import { loadFont as loadLibreBaskerville } from '@remotion/google-fonts/LibreBaskerville'
import { loadFont as loadCrimsonText } from '@remotion/google-fonts/CrimsonText'
import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel'
import { loadFont as loadTeko } from '@remotion/google-fonts/Teko'
import { loadFont as loadRighteous } from '@remotion/google-fonts/Righteous'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { loadFont as loadBarlowCondensed } from '@remotion/google-fonts/BarlowCondensed'
import { loadFont as loadDancingScript } from '@remotion/google-fonts/DancingScript'
import { loadFont as loadSacramento } from '@remotion/google-fonts/Sacramento'
import { loadFont as loadSatisfy } from '@remotion/google-fonts/Satisfy'
import { loadFont as loadPacifico } from '@remotion/google-fonts/Pacifico'
import { loadFont as loadCaveat } from '@remotion/google-fonts/Caveat'

import type { BrandIdentity } from './ReelTemplates'
import type { ResolvedSceneDef, ResolvedTextDef } from '@/types/template-scenes'
import { calcTextDurationFrames, calcSceneDurationFrames, resolvedText, MIN_TEXT_DURATION_SECS, REMOTION_FPS } from '@/types/template-scenes'

// ── Font pre-loading (identical to ReelTemplates.tsx) ─────────────────────────
const fontLoaders = [
  loadAnton(), loadBebasNeue(), loadOswald(), loadInter(), loadMontserrat(),
  loadPoppins(), loadDMSans(), loadNunito(), loadRaleway(), loadPlayfairDisplay(),
  loadBlackHanSans(), loadManrope(), loadUrbanist(), loadOutfit(), loadFigtree(),
  loadSpaceGrotesk(), loadSora(), loadLato(), loadRoboto(), loadWorkSans(),
  loadBarlow(), loadKanit(), loadMerriweather(), loadLora(), loadCormorant(),
  loadLibreBaskerville(), loadCrimsonText(), loadCinzel(), loadTeko(),
  loadRighteous(), loadArchivoBlack(), loadBarlowCondensed(), loadDancingScript(),
  loadSacramento(), loadSatisfy(), loadPacifico(), loadCaveat(),
]

// ── Safe zone (Instagram UI overlay areas) ────────────────────────────────────
const SAFE_ZONE = { top: 220, bottom: 450, left: 160, right: 160 } as const
const SAFE_W = 1080 - SAFE_ZONE.left - SAFE_ZONE.right // 760
const SAFE_H = 1920 - SAFE_ZONE.top - SAFE_ZONE.bottom // 1250

// ── isomorphic layout effect ──────────────────────────────────────────────────
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// ── TextZone — safe-zone-aware positioning ────────────────────────────────────
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
          gap: 12,
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
          gap: 12,
        }}
      >
        {children}
      </div>
    )
  }
  // center: span full canvas so text is vertically centered on the whole frame
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
        gap: 12,
      }}
    >
      {children}
    </div>
  )
}

// ── BrollBackground — handles video loop + overlay ────────────────────────────
function BrollBackground({
  videoUrl,
  startFrom,
  durationInFrames,
  overlayColor,
  overlayOpacity,
}: {
  videoUrl?: string | null
  startFrom?: number
  durationInFrames?: number
  overlayColor: string
  overlayOpacity: number
}) {
  if (!videoUrl) {
    return <div style={{ position: 'absolute', inset: 0, background: '#111' }} />
  }
  return (
    <>
      <Loop durationInFrames={durationInFrames || 9999}>
        <OffthreadVideo
          src={videoUrl}
          startFrom={startFrom ?? 0}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          muted
        />
      </Loop>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(${hexToRgb(overlayColor)},${overlayOpacity})`,
        }}
      />
    </>
  )
}

// ── FitText — font-size auto-shrink to fit bounding box ───────────────────────
function FitText({
  text,
  fontFamily,
  color,
  maxTextSize,
  textStyle,
  styleColor,
  horizontalAlign,
  boxWidth,
  frameOffset = 0,
}: {
  text: string
  fontFamily: string
  color: string
  maxTextSize: number // percentage 10-100
  textStyle: 'none' | 'stroke' | 'background_block'
  styleColor: string
  horizontalAlign: 'left' | 'center' | 'right'
  boxWidth: number
  frameOffset?: number
}) {
  const frame = useCurrentFrame()
  const containerRef = useRef<HTMLDivElement>(null)
  const BASE_FONT_SIZE = 80
  const [fontSize, setFontSize] = useState(() => Math.round(BASE_FONT_SIZE * (maxTextSize / 100)))

  const [handle] = useState(() => delayRender('DynamicFitText font load'))
  useEffect(() => {
    Promise.all(fontLoaders).then(() => continueRender(handle))
  }, [handle])

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const target = Math.round(BASE_FONT_SIZE * (maxTextSize / 100))
    let size = target
    el.style.fontSize = `${size}px`
    // Shrink until text fits within the box width
    while (el.scrollWidth > boxWidth && size > 12) {
      size -= 2
      el.style.fontSize = `${size}px`
    }
    setFontSize(size)
  }, [text, maxTextSize, fontFamily, boxWidth])

  const opacity = interpolate(frame - frameOffset, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const translateY = interpolate(frame - frameOffset, [0, 10], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const textShadow = textStyle === 'none' ? '0 2px 20px rgba(0,0,0,0.8)' : 'none'
  const webkitStroke = textStyle === 'stroke' ? `2px ${styleColor}` : undefined
  const bgPadding = textStyle === 'background_block' ? '8px 20px' : undefined
  const bgColor = textStyle === 'background_block' ? styleColor : undefined
  const borderRadius = textStyle === 'background_block' ? '8px' : undefined

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        width: boxWidth,
        display: 'flex',
        justifyContent:
          horizontalAlign === 'left' ? 'flex-start' : horizontalAlign === 'right' ? 'flex-end' : 'center',
      }}
    >
      <div
        ref={containerRef}
        style={{
          fontFamily,
          fontSize,
          fontWeight: 700,
          color,
          textAlign: horizontalAlign,
          lineHeight: 1.2,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          textShadow,
          letterSpacing: '-0.5px',
          WebkitTextStroke: webkitStroke,
          padding: bgPadding,
          backgroundColor: bgColor,
          borderRadius,
          display: 'inline-block',
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        {text}
      </div>
    </div>
  )
}

// ── SceneRenderer — renders one scene at relative frame 0 ─────────────────────
function SceneRenderer({ scene, brand }: { scene: ResolvedSceneDef; brand?: BrandIdentity }) {
  const frame = useCurrentFrame()

  // Accumulate text start frames
  const textStartFrames: number[] = []
  let acc = 0
  for (const t of scene.texts) {
    textStartFrames.push(acc)
    acc += calcTextDurationFrames(resolvedText(t))
  }

  // Resolve null scene-level fields using brand identity
  const overlayColor = scene.overlayColor ?? brand?.primaryColor ?? '#000000'
  const overlayOpacity = scene.overlayOpacity ?? brand?.overlayOpacity ?? 0.55

  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <BrollBackground
        videoUrl={scene.resolvedBackgroundVideoUrl}
        startFrom={scene.resolvedBrollStartFrom}
        durationInFrames={
          scene.backgroundVideoDurationSecs
            ? Math.round(scene.backgroundVideoDurationSecs * REMOTION_FPS)
            : undefined
        }
        overlayColor={overlayColor}
        overlayOpacity={overlayOpacity}
      />

      <TextZone align={scene.textVerticalAlign}>
        {scene.texts.map((text, i) => {
          const textStart = textStartFrames[i]
          const textDuration = calcTextDurationFrames(resolvedText(text))
          const isActive = frame >= textStart && frame < textStart + textDuration
          if (!isActive) return null
          // Resolve null text-level fields using brand identity
          const font = text.font ?? brand?.titleFont ?? 'Inter'
          const color = text.color ?? brand?.secondaryColor ?? '#ffffff'
          const maxTextSize = text.maxTextSize ?? brand?.maxTextSize ?? 100
          return (
            <FitText
              key={text.id}
              text={resolvedText(text)}
              fontFamily={font}
              color={color}
              maxTextSize={maxTextSize}
              textStyle={text.textStyle}
              styleColor={text.styleColor}
              horizontalAlign={text.horizontalAlign}
              boxWidth={SAFE_W}
              frameOffset={frame - textStart}
            />
          )
        })}
      </TextZone>
    </AbsoluteFill>
  )
}

// ── DynamicReelComposition — main export ──────────────────────────────────────

export interface DynamicReelProps {
  scenes: ResolvedSceneDef[]
  audioUrl?: string
  brand?: BrandIdentity
}

export function DynamicReelComposition({ scenes, audioUrl, brand }: DynamicReelProps) {
  if (!scenes || scenes.length === 0) {
    return (
      <AbsoluteFill style={{ background: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', fontSize: 32 }}>No scenes defined</div>
      </AbsoluteFill>
    )
  }

  // Build scene start frames
  const sceneStartFrames: number[] = []
  let frameAcc = 0
  for (const scene of scenes) {
    sceneStartFrames.push(frameAcc)
    frameAcc += calcSceneDurationFrames(scene)
  }

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {audioUrl && <Audio src={audioUrl} />}
      {scenes.map((scene, i) => {
        const start = sceneStartFrames[i]
        const duration = calcSceneDurationFrames(scene)
        return (
          <Sequence key={scene.id} from={start} durationInFrames={duration}>
            <SceneRenderer scene={scene} brand={brand} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

// ── calculateMetadata helper (used by index.tsx) ──────────────────────────────

import { MAX_REEL_FRAMES, calcTotalReelFrames } from '@/types/template-scenes'

export function calcDynamicReelFrames(scenes: ResolvedSceneDef[]): number {
  if (!scenes || scenes.length === 0) return Math.round(MIN_TEXT_DURATION_SECS * REMOTION_FPS)
  return Math.min(calcTotalReelFrames(scenes), MAX_REEL_FRAMES)
}

// ── Utility ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '0,0,0'
  return `${r},${g},${b}`
}
