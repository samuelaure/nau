import { bundle } from '@remotion/bundler'
import { renderStill, getCompositions } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'
import { logger, logError } from '@/modules/shared/logger'

// ─── Constants ─────────────────────────────────────────────────────

const ENTRY_POINT = path.join(process.cwd(), 'src/modules/video/remotion/index.tsx')
const OUTPUT_DIR = path.join(process.cwd(), 'out')

// ─── Types ─────────────────────────────────────────────────────────

interface SlideRenderInput {
  compositionId: string
  inputProps: Record<string, unknown>
  frame: number
  outputPath: string
  width?: number
  height?: number
  imageFormat?: 'png' | 'jpeg'
  jpegQuality?: number
}

// ─── Slide Renderer ────────────────────────────────────────────────

/**
 * Render a single frame from a Remotion composition as a still image.
 * Used for carousel slides and single image formats.
 */
export async function renderSlide(input: SlideRenderInput): Promise<void> {
  const {
    compositionId,
    inputProps,
    frame,
    outputPath,
    imageFormat = 'png',
    jpegQuality = 85,
  } = input

  // Ensure output directory exists
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const bundleLocation = await bundle(ENTRY_POINT)

  const comps = await getCompositions(bundleLocation, { inputProps })
  const composition = comps.find((c) => c.id === compositionId)

  if (!composition) {
    throw new Error(`[StillRenderer] Composition '${compositionId}' not found`)
  }

  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: outputPath,
    inputProps,
    frame: Math.min(frame, composition.durationInFrames - 1),
    imageFormat,
    jpegQuality,
  })

  logger.info(`[StillRenderer] Rendered frame ${frame} → ${outputPath}`)
}

// ─── Carousel Renderer ─────────────────────────────────────────────

interface CarouselRenderInput {
  compositionId: string
  slides: Array<{
    inputProps: Record<string, unknown>
    frame: number
  }>
  baseOutputPath: string
  width?: number
  height?: number
}

/**
 * Render all slides of a carousel composition sequentially.
 * Returns an array of local file paths for the rendered slides.
 */
export async function renderCarousel(input: CarouselRenderInput): Promise<string[]> {
  const { compositionId, slides, baseOutputPath } = input

  const outputPaths: string[] = []

  // Bundle once for all slides
  const bundleLocation = await bundle(ENTRY_POINT)

  const comps = await getCompositions(bundleLocation, {
    inputProps: slides[0]?.inputProps ?? {},
  })
  const composition = comps.find((c) => c.id === compositionId)

  if (!composition) {
    throw new Error(`[StillRenderer] Composition '${compositionId}' not found`)
  }

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const outputPath = `${baseOutputPath}_slide_${i}.png`

    try {
      await renderStill({
        composition,
        serveUrl: bundleLocation,
        output: outputPath,
        inputProps: slide.inputProps,
        frame: Math.min(slide.frame, composition.durationInFrames - 1),
        imageFormat: 'png',
      })

      outputPaths.push(outputPath)
      logger.info(`[StillRenderer] Carousel slide ${i + 1}/${slides.length} → ${outputPath}`)
    } catch (err) {
      logError(`[StillRenderer] Failed to render carousel slide ${i}`, err)
      throw err
    }
  }

  return outputPaths
}
