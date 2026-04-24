import { Worker, type Job } from 'bullmq'
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, getCompositions } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { flownau } from 'nau-storage'
import { selectAssetsForCreative } from '@/modules/composer/asset-curator'
import { logger, logError } from '@/modules/shared/logger'
import { redisConnection, type RenderJobData } from './render-queue'

// ─── Constants ─────────────────────────────────────────────────────

const CONCURRENCY = parseInt(process.env.RENDER_CONCURRENCY || '1', 10)
const OUTPUT_DIR = path.join(process.cwd(), 'out')
const ENTRY_POINT = path.join(process.cwd(), 'src/modules/video/remotion/index.tsx')

// ─── Helpers ───────────────────────────────────────────────────────

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (err) {
    logger.warn(
      `[RenderWorker] Failed to clean up temp file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

// ─── Worker Processor ──────────────────────────────────────────────

async function processRenderJob(job: Job<RenderJobData>): Promise<void> {
  const { compositionId } = job.data
  const startTime = Date.now()

  logger.info(
    `[RenderWorker] Processing job ${job.id} for composition ${compositionId} (attempt ${job.attemptsMade + 1})`,
  )

  // 1. Fetch composition from DB
  const composition = await prisma.composition.findUnique({
    where: { id: compositionId },
    include: { account: true },
  })

  if (!composition) {
    throw new Error(`Composition ${compositionId} not found in DB`)
  }

  // 2. Create/update RenderJob record
  const renderJob = await prisma.renderJob.upsert({
    where: { compositionId },
    update: {
      status: 'rendering',
      attempts: job.attemptsMade + 1,
      startedAt: new Date(),
      error: null,
    },
    create: {
      compositionId,
      status: 'rendering',
      attempts: 1,
      startedAt: new Date(),
      outputType:
        composition.format === 'reel' || composition.format === 'trial_reel' ? 'video' : 'image',
    },
  })

  // 3. On retry (attempt > 1), re-select assets for variety
  const payload = composition.payload as Record<string, unknown>
  if (job.attemptsMade > 0 && composition.creative) {
    logger.info(`[RenderWorker] Retry attempt ${job.attemptsMade + 1} — re-selecting assets`)
    try {
      const creative = composition.creative as Record<string, unknown>
      const { sceneAssets } = await selectAssetsForCreative(
        creative as Parameters<typeof selectAssetsForCreative>[0],
        composition.accountId,
        30,
      )
      logger.info(`[RenderWorker] Re-selected ${sceneAssets.size} assets for retry`)
    } catch (retryErr) {
      logError(
        '[RenderWorker] Asset re-selection failed, proceeding with original assets',
        retryErr,
      )
    }
  }

  await job.updateProgress(10)

  // Phase 18: passthrough branch for user-managed formats (head_talk / replicate).
  const USER_MANAGED_FORMATS = new Set(['head_talk', 'replicate'])
  if (USER_MANAGED_FORMATS.has(composition.format) && composition.userUploadedMediaUrl) {
    const renderTimeMs = Date.now() - startTime
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: {
        status: 'done',
        progress: 100,
        outputUrl: composition.userUploadedMediaUrl,
        outputType: 'video',
        completedAt: new Date(),
        renderTimeMs,
      },
    })
    await prisma.composition.update({
      where: { id: compositionId },
      data: {
        videoUrl: composition.userUploadedMediaUrl,
        status: 'rendered',
      },
    })
    await job.updateProgress(100)
    logger.info(`[RenderWorker] Passthrough complete for ${compositionId} (${composition.format})`)
    return
  }

  // 4. Determine render type
  const format = composition.format || 'reel'
  const isVideo = format === 'reel' || format === 'trial_reel'
  const compositionId_ = isVideo ? 'SceneSequence' : 'DynamicTemplateMaster'

  ensureOutputDir()

  // 5. Bundle Remotion entry
  logger.info(`[RenderWorker] Bundling Remotion composition...`)
  const bundleLocation = await bundle(ENTRY_POINT, () => {}, {
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          '@': path.resolve(process.cwd(), 'src'),
        },
      },
    }),
  })
  await job.updateProgress(30)

  // 6. Resolve composition from bundle
  const comps = await getCompositions(bundleLocation, {
    inputProps: { schema: payload },
  })
  const remotionComp = comps.find((c) => c.id === compositionId_)

  if (!remotionComp) {
    throw new Error(`Remotion composition '${compositionId_}' not found in bundle`)
  }

  const accountId = composition.accountId

  if (isVideo) {
    // ─── Video Render ────────────────────────────────────────
    const outputPath = path.join(OUTPUT_DIR, `render-${compositionId}.mp4`)

    logger.info(`[RenderWorker] Rendering video (${remotionComp.durationInFrames} frames)...`)
    await renderMedia({
      composition: remotionComp,
      serveUrl: bundleLocation,
      outputLocation: outputPath,
      inputProps: { schema: payload },
      codec: 'h264',
      concurrency: CONCURRENCY,
      jpegQuality: 80,
      onProgress: ({ progress }) => {
        job.updateProgress(30 + Math.round(progress * 50)).catch(() => {})
      },
    })

    await job.updateProgress(80)

    logger.info(`[RenderWorker] Uploading video to R2...`)
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: { status: 'uploading' },
    })

    const videoR2Key = flownau.renderOutput(accountId, compositionId)
    const videoPublicUrl = await storage.upload(videoR2Key, fs.createReadStream(outputPath), {
      mimeType: 'video/mp4',
    })
    cleanupFile(outputPath)

    await job.updateProgress(90)

    // 8. Extract cover image
    let coverUrl: string | null = null
    const creative = composition.creative as Record<string, unknown> | null

    if (creative && typeof creative === 'object') {
      const coverIdx = (creative as { coverSceneIndex?: number }).coverSceneIndex ?? 0
      const scenes = (payload as { scenes?: unknown[] }).scenes
      const totalFrames = remotionComp.durationInFrames

      let coverFrame = 0
      if (scenes && Array.isArray(scenes) && coverIdx < scenes.length) {
        const scene = scenes[coverIdx] as { startFrame?: number; durationInFrames?: number }
        coverFrame = (scene.startFrame ?? 0) + Math.floor((scene.durationInFrames ?? 30) / 2)
      }
      coverFrame = Math.min(coverFrame, totalFrames - 1)

      const coverPath = path.join(OUTPUT_DIR, `cover-${compositionId}.jpg`)
      try {
        await renderStill({
          composition: remotionComp,
          serveUrl: bundleLocation,
          output: coverPath,
          inputProps: { schema: payload },
          frame: coverFrame,
          imageFormat: 'jpeg',
          jpegQuality: 85,
        })

        const coverR2Key = flownau.renderCover(accountId, compositionId)
        coverUrl = await storage.upload(coverR2Key, fs.createReadStream(coverPath), {
          mimeType: 'image/jpeg',
        })
        cleanupFile(coverPath)
      } catch (coverErr) {
        logError('[RenderWorker] Cover extraction failed, proceeding without cover', coverErr)
      }
    }

    await job.updateProgress(95)

    const renderTimeMs = Date.now() - startTime
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: {
        status: 'done',
        progress: 100,
        outputUrl: videoPublicUrl,
        completedAt: new Date(),
        renderTimeMs,
      },
    })

    await prisma.composition.update({
      where: { id: compositionId },
      data: {
        videoUrl: videoPublicUrl,
        coverUrl,
        status: 'rendered',
      },
    })

    logger.info(`[RenderWorker] Video render complete: ${compositionId} (${renderTimeMs}ms)`)
  } else {
    // ─── Still Render ─────────────────────────────────────────
    const outputPath = path.join(OUTPUT_DIR, `render-${compositionId}.png`)

    logger.info(`[RenderWorker] Rendering still image...`)
    await renderStill({
      composition: remotionComp,
      serveUrl: bundleLocation,
      output: outputPath,
      inputProps: { schema: payload },
      frame: 0,
      imageFormat: 'png',
    })

    await job.updateProgress(80)

    const imageR2Key = flownau.renderStill(accountId, compositionId)
    const imagePublicUrl = await storage.upload(imageR2Key, fs.createReadStream(outputPath), {
      mimeType: 'image/png',
    })
    cleanupFile(outputPath)

    const renderTimeMs = Date.now() - startTime
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: {
        status: 'done',
        progress: 100,
        outputUrl: imagePublicUrl,
        outputType: 'image',
        completedAt: new Date(),
        renderTimeMs,
      },
    })

    await prisma.composition.update({
      where: { id: compositionId },
      data: {
        videoUrl: imagePublicUrl,
        status: 'rendered',
      },
    })

    logger.info(`[RenderWorker] Still render complete: ${compositionId} (${renderTimeMs}ms)`)
  }

  await job.updateProgress(100)
}

// ─── Worker Lifecycle ──────────────────────────────────────────────

function handleFailedJob(job: Job<RenderJobData> | undefined, error: Error): void {
  if (!job) return
  const { compositionId } = job.data

  logError(`[RenderWorker] Job ${job.id} failed`, error)

  if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
    prisma.renderJob
      .update({
        where: { compositionId },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        },
      })
      .then(() =>
        prisma.composition.update({
          where: { id: compositionId },
          data: { status: 'failed' },
        }),
      )
      .catch((dbErr) => logError('[RenderWorker] Failed to update failed status in DB', dbErr))
  }
}

// ─── Start Worker ──────────────────────────────────────────────────

export function startRenderWorker(): Worker<RenderJobData> {
  const worker = new Worker<RenderJobData>('flownau-render', processRenderJob, {
    connection: redisConnection,
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 60_000,
    },
  })

  worker.on('completed', (job) => {
    logger.info(`[RenderWorker] Job ${job.id} completed successfully`)
  })

  worker.on('failed', (job, error) => {
    handleFailedJob(job, error)
  })

  worker.on('error', (error) => {
    logError('[RenderWorker] Worker error', error)
  })

  logger.info('[RenderWorker] Render worker started, listening for jobs...')

  return worker
}

// ─── Standalone Entry Point ────────────────────────────────────────

import { fileURLToPath } from 'node:url'
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isMain) {
  logger.info('[RenderWorker] Starting standalone render worker...')
  startRenderWorker()
}
