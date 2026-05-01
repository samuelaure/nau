import { Worker, type Job } from 'bullmq'
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, getCompositions } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/modules/shared/prisma'
import { storage } from '@/modules/shared/r2'
import { flownau } from 'nau-storage'
import { logger, logError } from '@/modules/shared/logger'
import { redisConnection, type RenderJobData } from './render-queue'
import type { BrandIdentity } from '@/modules/video/remotion/ReelTemplates'

const SLOT_REEL_IDS = new Set(['ReelT1', 'ReelT2', 'ReelT3', 'ReelT4'])

const CONCURRENCY = parseInt(process.env.RENDER_CONCURRENCY || '1', 10)
const OUTPUT_DIR = path.join(process.cwd(), 'out')
const ENTRY_POINT = path.join(process.cwd(), 'src/modules/video/remotion/index.tsx')

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (err) {
    logger.warn(`[RenderWorker] Failed to clean up temp file ${filePath}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function processRenderJob(job: Job<RenderJobData>): Promise<void> {
  const { postId } = job.data
  const startTime = Date.now()

  logger.info(`[RenderWorker] Processing job ${job.id} for post ${postId} (attempt ${job.attemptsMade + 1})`)

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { brand: true, template: true },
  })

  if (!post) throw new Error(`Post ${postId} not found in DB`)

  const renderJob = await prisma.renderJob.upsert({
    where: { postId },
    update: { status: 'rendering', attempts: job.attemptsMade + 1, startedAt: new Date(), error: null },
    create: {
      postId,
      status: 'rendering',
      attempts: 1,
      startedAt: new Date(),
      outputType: post.format === 'reel' || post.format === 'trial_reel' ? 'video' : 'image',
    },
  })

  await job.updateProgress(10)

  // ── Passthrough: user-managed formats (head_talk, replicate) ──────────────────
  const USER_MANAGED_FORMATS = new Set(['head_talk', 'replicate'])
  if (USER_MANAGED_FORMATS.has(post.format ?? '') && post.userUploadedMediaUrl) {
    const renderTimeMs = Date.now() - startTime
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: { status: 'done', progress: 100, outputUrl: post.userUploadedMediaUrl, outputType: 'video', completedAt: new Date(), renderTimeMs },
    })
    await prisma.post.update({
      where: { id: postId },
      data: { videoUrl: post.userUploadedMediaUrl, status: 'RENDERED_PENDING' },
    })
    await job.updateProgress(100)
    logger.info(`[RenderWorker] Passthrough complete for ${postId} (${post.format})`)
    return
  }

  const format = post.format || 'reel'
  const isVideo = format === 'reel' || format === 'trial_reel'
  const brandId = post.brandId

  // Determine which Remotion composition to use
  const templateRemotionId = post.template?.remotionId ?? ''
  if (!isVideo || !SLOT_REEL_IDS.has(templateRemotionId)) {
    throw new Error(`Post ${postId} has unsupported format/template: ${format}/${templateRemotionId}`)
  }
  const remotionCompId = templateRemotionId

  // ── Build Remotion inputProps ─────────────────────────────────────────────────
  const creative = post.creative as Record<string, unknown> | null
  if (!creative?.slots) {
    throw new Error(`Post ${postId} has no slot creative — cannot render ${templateRemotionId}`)
  }

  // Select B-roll assets by mood keywords
  const brollMood = (creative.brollMood as string) ?? ''
  const moodKeywords = brollMood.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)

  const brandAssets = await prisma.asset.findMany({
    where: {
      brandId,
      type: { in: ['video', 'VID'] },
      ...(moodKeywords.length > 0 ? { tags: { hasSome: moodKeywords } } : {}),
    },
    select: { url: true },
    take: 10,
  })

  // Fallback: any brand video if mood query returns nothing
  const allBrandVideos = brandAssets.length === 0
    ? await prisma.asset.findMany({ where: { brandId, type: { in: ['video', 'VID'] } }, select: { url: true }, take: 5 })
    : brandAssets

  const brollUrls = allBrandVideos.map((a) => a.url)
  const brandIdentity = (post.brand?.brandIdentity ?? {}) as BrandIdentity

  const inputProps: Record<string, unknown> = {
    slots: creative.slots,
    caption: creative.caption ?? '',
    hashtags: creative.hashtags ?? [],
    brollUrls,
    brand: brandIdentity,
  }

  await job.updateProgress(20)

  ensureOutputDir()

  logger.info(`[RenderWorker] Bundling Remotion composition...`)
  const bundleLocation = await bundle(ENTRY_POINT, () => {}, {
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: { ...config.resolve?.alias, '@': path.resolve(process.cwd(), 'src') },
      },
    }),
  })
  await job.updateProgress(35)

  const comps = await getCompositions(bundleLocation, { inputProps })
  const remotionComp = comps.find((c) => c.id === remotionCompId)
  if (!remotionComp) throw new Error(`Remotion composition '${remotionCompId}' not found in bundle`)

  if (isVideo) {
    const outputPath = path.join(OUTPUT_DIR, `render-${postId}.mp4`)

    logger.info(`[RenderWorker] Rendering video (${remotionComp.durationInFrames} frames)...`)
    await renderMedia({
      composition: remotionComp,
      serveUrl: bundleLocation,
      outputLocation: outputPath,
      inputProps,
      codec: 'h264',
      concurrency: CONCURRENCY,
      jpegQuality: 95,
      onProgress: ({ progress }) => { job.updateProgress(35 + Math.round(progress * 45)).catch(() => {}) },
    })

    await job.updateProgress(80)
    logger.info(`[RenderWorker] Uploading video to R2...`)
    await prisma.renderJob.update({ where: { id: renderJob.id }, data: { status: 'uploading' } })

    const videoR2Key = flownau.renderOutput(brandId, postId)
    const videoPublicUrl = await storage.upload(videoR2Key, fs.createReadStream(outputPath), { mimeType: 'video/mp4' })
    cleanupFile(outputPath)

    await job.updateProgress(90)

    // Extract cover frame from the resolved scenes
    let coverUrl: string | null = null
    const scenes = inputProps.scenes as Array<{ startFrame: number; durationInFrames: number }> | undefined
    const creative = post.creative as { coverSceneIndex?: number } | null
    const coverIdx = creative?.coverSceneIndex ?? 0

    let coverFrame = 0
    if (scenes && coverIdx < scenes.length) {
      const s = scenes[coverIdx]
      coverFrame = s.startFrame + Math.floor(s.durationInFrames / 2)
    }
    coverFrame = Math.min(coverFrame, remotionComp.durationInFrames - 1)

    const coverPath = path.join(OUTPUT_DIR, `cover-${postId}.jpg`)
    try {
      await renderStill({
        composition: remotionComp,
        serveUrl: bundleLocation,
        output: coverPath,
        inputProps,
        frame: coverFrame,
        imageFormat: 'jpeg',
        jpegQuality: 95,
      })
      const coverR2Key = flownau.renderCover(brandId, postId)
      coverUrl = await storage.upload(coverR2Key, fs.createReadStream(coverPath), { mimeType: 'image/jpeg' })
      cleanupFile(coverPath)
    } catch (coverErr) {
      logError('[RenderWorker] Cover extraction failed, proceeding without cover', coverErr)
    }

    await job.updateProgress(95)

    const renderTimeMs = Date.now() - startTime
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: { status: 'done', progress: 100, outputUrl: videoPublicUrl, completedAt: new Date(), renderTimeMs },
    })
    await prisma.post.update({
      where: { id: postId },
      data: { videoUrl: videoPublicUrl, coverUrl, status: 'RENDERED_PENDING' },
    })

    logger.info(`[RenderWorker] Video render complete: ${postId} (${renderTimeMs}ms)`)
  } else {
    const outputPath = path.join(OUTPUT_DIR, `render-${postId}.png`)

    logger.info(`[RenderWorker] Rendering still image...`)
    await renderStill({
      composition: remotionComp,
      serveUrl: bundleLocation,
      output: outputPath,
      inputProps,
      frame: 0,
      imageFormat: 'png',
    })

    await job.updateProgress(80)

    const imageR2Key = flownau.renderStill(brandId, postId)
    const imagePublicUrl = await storage.upload(imageR2Key, fs.createReadStream(outputPath), { mimeType: 'image/png' })
    cleanupFile(outputPath)

    const renderTimeMs = Date.now() - startTime
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: { status: 'done', progress: 100, outputUrl: imagePublicUrl, outputType: 'image', completedAt: new Date(), renderTimeMs },
    })
    await prisma.post.update({
      where: { id: postId },
      data: { videoUrl: imagePublicUrl, status: 'RENDERED_PENDING' },
    })

    logger.info(`[RenderWorker] Still render complete: ${postId} (${renderTimeMs}ms)`)
  }

  await job.updateProgress(100)
}

function handleFailedJob(job: Job<RenderJobData> | undefined, error: Error): void {
  if (!job) return
  const { postId } = job.data

  logError(`[RenderWorker] Job ${job.id} failed`, error)

  if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
    prisma.renderJob
      .update({ where: { postId }, data: { status: 'failed', error: error.message, completedAt: new Date() } })
      .then(() => prisma.post.update({ where: { id: postId }, data: { status: 'RENDERING' } }))
      .catch((dbErr) => logError('[RenderWorker] Failed to update failed status in DB', dbErr))
  }
}

export function startRenderWorker(): Worker<RenderJobData> {
  const worker = new Worker<RenderJobData>('flownau-render', processRenderJob, {
    connection: redisConnection,
    concurrency: 1,
    limiter: { max: 5, duration: 60_000 },
  })

  worker.on('completed', (job) => { logger.info(`[RenderWorker] Job ${job.id} completed successfully`) })
  worker.on('failed', (job, error) => { handleFailedJob(job, error) })
  worker.on('error', (error) => { logError('[RenderWorker] Worker error', error) })

  logger.info('[RenderWorker] Render worker started, listening for jobs...')
  return worker
}

import { fileURLToPath } from 'node:url'
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  logger.info('[RenderWorker] Starting standalone render worker...')
  startRenderWorker()
}
