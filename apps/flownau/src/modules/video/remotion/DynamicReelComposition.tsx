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
import type { ResolvedSceneDef, ResolvedTextDef, TextStyle, HorizontalAlign } from '@/types/template-scenes'
import { calcTextDurationFrames, calcSceneDurationFrames, resolvedText, MIN_TEXT_DURATION_SECS, REMOTION_FPS } from '@/types/template-scenes'

// ── Font loader registry ──────────────────────────────────────────────────────
// Maps font name (as stored in DB) → loader function.
// Each loader returns { fontFamily, waitUntilDone } — we only call waitUntilDone
// for fonts actually used in the composition to avoid loading all 37 fonts.
const FONT_LOADERS: Record<string, () => { fontFamily: string; waitUntilDone: () => Promise<void> }> = {
  'Anton': loadAnton,
  'Bebas Neue': loadBebasNeue,
  'Oswald': loadOswald,
  'Inter': loadInter,
  'Montserrat': loadMontserrat,
  'Poppins': loadPoppins,
  'DM Sans': loadDMSans,
  'Nunito': loadNunito,
  'Raleway': loadRaleway,
  'Playfair Display': loadPlayfairDisplay,
  'Black Han Sans': loadBlackHanSans,
  'Manrope': loadManrope,
  'Urbanist': loadUrbanist,
  'Outfit': loadOutfit,
  'Figtree': loadFigtree,
  'Space Grotesk': loadSpaceGrotesk,
  'Sora': loadSora,
  'Lato': loadLato,
  'Roboto': loadRoboto,
  'Work Sans': loadWorkSans,
  'Barlow': loadBarlow,
  'Kanit': loadKanit,
  'Merriweather': loadMerriweather,
  'Lora': loadLora,
  'Cormorant': loadCormorant,
  'Libre Baskerville': loadLibreBaskerville,
  'Crimson Text': loadCrimsonText,
  'Cinzel': loadCinzel,
  'Teko': loadTeko,
  'Righteous': loadRighteous,
  'Archivo Black': loadArchivoBlack,
  'Barlow Condensed': loadBarlowCondensed,
  'Dancing Script': loadDancingScript,
  'Sacramento': loadSacramento,
  'Satisfy': loadSatisfy,
  'Pacifico': loadPacifico,
  'Caveat': loadCaveat,
}

// ── useLoadTemplateFonts ──────────────────────────────────────────────────────
// Loads only the fonts actually referenced by this composition, waiting until
// each is ready before unblocking Remotion rendering. This guarantees that
// FitText layout measurements run against the real custom font, not a fallback.
function useLoadTemplateFonts(fontNames: string[]) {
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const [handle] = useState(() => delayRender('DynamicReel font load'))

  useEffect(() => {
    const unique = [...new Set(fontNames.filter(Boolean))]
    const waiters = unique
      .map((name) => FONT_LOADERS[name])
      .filter(Boolean)
      .map((loader) => loader().waitUntilDone())

    Promise.all(waiters).then(() => {
      setFontsLoaded(true)
      continueRender(handle)
    })
  }, [handle]) // eslint-disable-line react-hooks/exhaustive-deps

  return fontsLoaded
}

// ── Safe zone (Instagram UI overlay areas) ────────────────────────────────────
const SAFE_ZONE = { top: 220, bottom: 450, left: 160, right: 160 } as const
const SAFE_W = 1080 - SAFE_ZONE.left - SAFE_ZONE.right // 760

// Generous fixed text box height inside the safe zone.
// Text that is too long will shrink to fit; short text stays at maxTextSize.
// Keeping this well below SAFE_H (1250) ensures top/center/bottom alignment
// actually works — a 100%-height child cannot be flex-aligned.
const TEXT_BOX_HEIGHT = 800

// ── isomorphic layout effect ──────────────────────────────────────────────────
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// ── TextZone — safe-zone-aware positioning ────────────────────────────────────
// The wrapper sits at the correct safe zone anchor; children (FitText boxes)
// are flex-aligned inside it.  Using a generous fixed height (SAFE_H) for the
// zone itself while children are a smaller TEXT_BOX_HEIGHT keeps alignment
// predictable: a "center" box is centred on screen, "top" sits near the
// top of the safe zone, "bottom" sits near the bottom.
function TextZone({
  children,
  align = 'center',
}: {
  children: React.ReactNode
  align?: 'top' | 'center' | 'bottom'
}) {
  const SAFE_H = 1920 - SAFE_ZONE.top - SAFE_ZONE.bottom // 1250

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
  // center: span full canvas height so text is centered on the whole device
  // screen, not on the asymmetric safe zone (bottom padding is 2× the top).
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
// Renders text inside a fixed bounding box. If the text overflows in either
// dimension, font size is reduced in steps until it fits. This mirrors the
// "text block" behaviour in design tools: the area is fixed, the type scales
// down to fill it completely.
function FitText({
  text,
  fontFamily,
  color,
  maxTextSize,
  textStyle,
  styleColor,
  horizontalAlign,
  boxWidth,
  boxHeight,
  textStart,
  instant,
}: {
  text: string
  fontFamily: string
  color: string
  maxTextSize: number
  textStyle: TextStyle
  styleColor: string
  horizontalAlign: HorizontalAlign
  boxWidth: number
  boxHeight: number
  textStart?: number
  instant?: boolean
}) {
  const frame = useCurrentFrame()
  const containerRef = useRef<HTMLDivElement>(null)
  const BASE_FONT_SIZE = 80
  const [fontSize, setFontSize] = useState(() => Math.round(BASE_FONT_SIZE * (maxTextSize / 100)))

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const target = Math.round(BASE_FONT_SIZE * (maxTextSize / 100))
    let size = target
    el.style.fontSize = `${size}px`
    // Shrink until text fits within both the width AND height of the box.
    // This is the critical dual-axis check that was working pre-feat/block-based-templates.
    while ((el.scrollWidth > boxWidth || el.scrollHeight > boxHeight) && size > 12) {
      size -= 2
      el.style.fontSize = `${size}px`
    }
    setFontSize(size)
  }, [text, maxTextSize, fontFamily, boxWidth, boxHeight])

  // Fade-in: interpolate from 0→1 opacity over first 10 frames since this text became active.
  const elapsed = frame - (textStart ?? 0)
  const opacity = instant
    ? 1
    : interpolate(elapsed, [0, 10], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
  const translateY = instant
    ? 0
    : interpolate(elapsed, [0, 10], [12, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })

  const textShadow = textStyle === 'none' ? '0 4px 28px rgba(0,0,0,0.9)' : 'none'
  const webkitStroke = textStyle === 'stroke' ? `2px ${styleColor}` : undefined
  const bgPadding = textStyle === 'background_block' ? '12px 32px' : undefined
  const bgColor = textStyle === 'background_block' ? styleColor : undefined
  const borderRadius = textStyle === 'background_block' ? '16px' : undefined

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        // Fixed bounding box — overflow is clipped so text never escapes the safe zone
        width: boxWidth,
        height: boxHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          horizontalAlign === 'left' ? 'flex-start' : horizontalAlign === 'right' ? 'flex-end' : 'center',
        overflow: 'hidden',
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
          // No height/maxHeight on the inner element — scrollHeight must
          // reflect the true rendered text height for the shrink loop to work.
        }}
      >
        {text}
      </div>
    </div>
  )
}

// ── SceneRenderer — renders one scene at relative frame 0 ─────────────────────
function SceneRenderer({
  scene,
  brand,
  isFirstScene,
}: {
  scene: ResolvedSceneDef
  brand?: BrandIdentity
  isFirstScene?: boolean
}) {
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
            ? Math.max(1, Math.round(scene.backgroundVideoDurationSecs * REMOTION_FPS) - (scene.resolvedBrollStartFrom ?? 0))
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
              boxHeight={TEXT_BOX_HEIGHT}
              textStart={textStart}
              instant={isFirstScene && i === 0 && textStart === 0}
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
  // Collect every unique font used across all scenes so we only load those.
  const usedFonts = [...new Set(
    (scenes ?? []).flatMap((s) =>
      s.texts.map((t) => t.font ?? brand?.titleFont ?? 'Inter')
    )
  )]
  const fontsLoaded = useLoadTemplateFonts(usedFonts)

  if (!fontsLoaded) {
    return <AbsoluteFill style={{ background: '#000' }} />
  }

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
            <SceneRenderer scene={scene} brand={brand} isFirstScene={i === 0} />
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
