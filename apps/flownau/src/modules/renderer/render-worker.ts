import { Worker, type Job } from 'bullmq'
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, getCompositions } from '@remotion/renderer'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/modules/shared/prisma'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/modules/shared/r2'
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

async function uploadToR2(
  localPath: string,
  r2Key: string,
  contentType: string,
): Promise<string> {
  const fileStream = fs.createReadStream(localPath)
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: fileStream,
      ContentType: contentType,
    }),
  )
  return `${R2_PUBLIC_URL}/${r2Key}`
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // Cleanup is best-effort
  }
}

// ─── Worker Processor ──────────────────────────────────────────────

async function processRenderJob(job: Job<RenderJobData>): Promise<void> {
  const { compositionId } = job.data
  const startTime = Date.now()

  logger.info(`[RenderWorker] Processing job ${job.id} for composition ${compositionId} (attempt ${job.attemptsMade + 1})`)

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
      outputType: composition.format === 'reel' || composition.format === 'trial_reel' ? 'video' : 'image',
    },
  })

  // 3. On retry (attempt > 1), re-select assets for variety
  let payload = composition.payload as Record<string, unknown>
  if (job.attemptsMade > 0 && composition.creative) {
    logger.info(`[RenderWorker] Retry attempt ${job.attemptsMade + 1} — re-selecting assets`)
    try {
      const creative = composition.creative as Record<string, unknown>
      const { sceneAssets, audioAsset } = await selectAssetsForCreative(
        creative as Parameters<typeof selectAssetsForCreative>[0],
        composition.accountId,
        30,
      )
      // Re-compile timeline would be needed here for full asset swap.
      // For now, log the re-selection — full re-compile is a Phase 4+ enhancement.
      logger.info(`[RenderWorker] Re-selected ${sceneAssets.size} assets for retry`)
    } catch (retryErr) {
      logError('[RenderWorker] Asset re-selection failed, proceeding with original assets', retryErr)
    }
  }

  await job.updateProgress(10)

  // 4. Determine render type
  const format = composition.format || 'reel'
  const isVideo = format === 'reel' || format === 'trial_reel'
  const compositionId_ = isVideo ? 'SceneSequence' : 'DynamicTemplateMaster'

  ensureOutputDir()

  // 5. Bundle Remotion entry
  logger.info(`[RenderWorker] Bundling Remotion composition...`)
  const bundleLocation = await bundle(ENTRY_POINT)
  await job.updateProgress(30)

  // 6. Resolve composition from bundle
  const comps = await getCompositions(bundleLocation, {
    inputProps: { schema: payload },
  })
  const remotionComp = comps.find((c) => c.id === compositionId_)

  if (!remotionComp) {
    throw new Error(`Remotion composition '${compositionId_}' not found in bundle`)
  }

  const projectFolder = composition.account?.username || composition.accountId

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
        const totalProgress = 30 + Math.round(progress * 50) // 30-80 range
        job.updateProgress(totalProgress).catch(() => {})
      },
    })

    await job.updateProgress(80)

    // 7. Upload video to R2
    logger.info(`[RenderWorker] Uploading video to R2...`)
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: { status: 'uploading' },
    })

    const videoR2Key = `${projectFolder}/outputs/${compositionId}.mp4`
    const videoPublicUrl = await uploadToR2(outputPath, videoR2Key, 'video/mp4')
    cleanupFile(outputPath)

    await job.updateProgress(90)

    // 8. Extract cover image
    let coverUrl: string | null = null
    const creative = composition.creative as Record<string, unknown> | null

    if (creative && typeof creative === 'object') {
      const coverIdx = (creative as { coverSceneIndex?: number }).coverSceneIndex ?? 0
      const scenes = (payload as { scenes?: unknown[] }).scenes
      const totalFrames = remotionComp.durationInFrames

      // Calculate frame position for cover scene
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

        const coverR2Key = `${projectFolder}/outputs/${compositionId}_cover.jpg`
        coverUrl = await uploadToR2(coverPath, coverR2Key, 'image/jpeg')
        cleanupFile(coverPath)
      } catch (coverErr) {
        logError('[RenderWorker] Cover extraction failed, proceeding without cover', coverErr)
      }
    }

    await job.updateProgress(95)

    // 9. Finalize DB records
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

    logger.info(
      `[RenderWorker] Video render complete: ${compositionId} (${renderTimeMs}ms)`,
    )
  } else {
    // ─── Still Render (single image or carousel) ─────────────
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

    // Upload
    const imageR2Key = `${projectFolder}/outputs/${compositionId}.png`
    const imagePublicUrl = await uploadToR2(outputPath, imageR2Key, 'image/png')
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

    logger.info(
      `[RenderWorker] Still render complete: ${compositionId} (${renderTimeMs}ms)`,
    )
  }

  await job.updateProgress(100)
}

// ─── Worker Lifecycle ──────────────────────────────────────────────

function handleFailedJob(job: Job<RenderJobData> | undefined, error: Error): void {
  if (!job) return
  const { compositionId } = job.data

  logError(`[RenderWorker] Job ${job.id} failed`, error)

  // Update DB on final failure (all retries exhausted)
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
      .catch((dbErr) =>
        logError('[RenderWorker] Failed to update failed status in DB', dbErr),
      )
  }
}

// ─── Start Worker ──────────────────────────────────────────────────

export function startRenderWorker(): Worker<RenderJobData> {
  const worker = new Worker<RenderJobData>(
    'flownau-render',
    processRenderJob,
    {
      connection: redisConnection,
      concurrency: 1, // One render at a time (GPU/memory bound)
      limiter: {
        max: 5,
        duration: 60_000, // Max 5 jobs per minute
      },
    },
  )

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
// When run directly (e.g., in the renderer container):
//   npx tsx src/modules/renderer/render-worker.ts

if (require.main === module) {
  logger.info('[RenderWorker] Starting standalone render worker...')
  startRenderWorker()
}
