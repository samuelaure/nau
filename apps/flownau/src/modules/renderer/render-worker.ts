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
import { BROLL_REQUIRED_FRAMES, REMOTION_FPS } from '@/modules/video/remotion/ReelTemplates'
import { shuffle } from '@/modules/video/utils/assets'
import type { ResolvedSceneDef } from '@/types/template-scenes'

// Legacy slot-based reel IDs
const SLOT_REEL_IDS = new Set(['ReelT1', 'ReelT2', 'ReelT3', 'ReelT4'])
// Block-based dynamic reel
const DYNAMIC_REEL_ID = 'DynamicReel'
const VIDEO_REEL_IDS = new Set([...SLOT_REEL_IDS, DYNAMIC_REEL_ID])

const CONCURRENCY = parseInt(process.env.RENDER_CONCURRENCY || '1', 10)
const OUTPUT_DIR = path.join(process.cwd(), 'out')
const ENTRY_POINT = path.join(process.cwd(), 'src/modules/video/remotion/index.tsx')

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

async function applyAutoApprovePost(
  postId: string,
  brandId: string,
  templateId: string | null,
): Promise<void> {
  if (!templateId) return
  const config = await prisma.brandTemplateConfig.findUnique({
    where: { brandId_templateId: { brandId, templateId } },
    select: { autoApprovePost: true },
  })
  if (config?.autoApprovePost) {
    await prisma.post.update({ where: { id: postId }, data: { status: 'RENDERED_APPROVED' } })
    logger.info(`[RenderWorker] Auto-approved post ${postId} for publishing`)
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

// ── resolveDynamicReelScenes ───────────────────────────────────────────────────
// For each scene: if backgroundVideoAssetId is set, fetch that exact asset URL.
// Otherwise, apply the same LRU random selection as the legacy path.

async function resolveDynamicReelScenes(
  creative: Record<string, unknown> | null,
  brandId: string,
  postId: string,
  renderJobId: string,
): Promise<ResolvedSceneDef[] | null> {
  if (!creative?.scenes || !Array.isArray(creative.scenes)) {
    await prisma.post.update({ where: { id: postId }, data: { status: 'DRAFT_PENDING' } })
    await prisma.renderJob.update({
      where: { id: renderJobId },
      data: { status: 'failed', error: 'No scenes creative — please recompose this post', completedAt: new Date() },
    })
    logger.warn({ postId }, '[RenderWorker] DynamicReel: no scenes — reset to DRAFT_PENDING')
    return null
  }

  const rawScenes = creative.scenes as ResolvedSceneDef[]

  // Collect IDs of scenes that need random LRU selection (no pinned video)
  const needsRandom = rawScenes.filter((s) => !s.backgroundVideoAssetId)

  // Pre-fetch random video pool once for all unset scenes
  let randomVideoPool: Array<{ id: string; url: string; duration: number | null; lastUsedAt: Date | null }> = []
  if (needsRandom.length > 0) {
    const allVideos = await prisma.asset.findMany({
      where: { brandId, type: { in: ['video', 'VID'] } },
      select: { id: true, url: true, duration: true, lastUsedAt: true },
      take: 50,
      orderBy: { lastUsedAt: { sort: 'asc', nulls: 'first' } },
    })
    const LRU_WINDOW = Math.min(allVideos.length, 10)
    randomVideoPool = shuffle(allVideos.slice(0, LRU_WINDOW))
  }

  let randomPoolIdx = 0
  const usedVideoIds: string[] = []
  const resolved: ResolvedSceneDef[] = []

  for (const scene of rawScenes) {
    if (scene.backgroundVideoAssetId) {
      // Pinned video — fetch the exact asset
      const asset = await prisma.asset.findUnique({
        where: { id: scene.backgroundVideoAssetId },
        select: { url: true, duration: true },
      })
      resolved.push({
        ...scene,
        resolvedBackgroundVideoUrl: asset?.url ?? null,
        resolvedBrollStartFrom: 0,
        backgroundVideoDurationSecs: asset?.duration ?? scene.backgroundVideoDurationSecs ?? null,
      })
    } else {
      // Random LRU selection
      const pick = randomVideoPool[randomPoolIdx % Math.max(1, randomVideoPool.length)]
      randomPoolIdx++
      if (pick) usedVideoIds.push(pick.id)
      const assetFrames = pick?.duration ? Math.floor(pick.duration * REMOTION_FPS) : 0
      const maxStart = Math.max(0, assetFrames - BROLL_REQUIRED_FRAMES)
      const startFrom = maxStart > 0 ? Math.floor(Math.random() * maxStart) : 0
      resolved.push({
        ...scene,
        resolvedBackgroundVideoUrl: pick?.url ?? null,
        resolvedBrollStartFrom: startFrom,
      })
    }
  }

  // Stamp used assets for LRU rotation
  if (usedVideoIds.length > 0) {
    await prisma.asset.updateMany({
      where: { id: { in: usedVideoIds } },
      data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
    })
  }

  logger.info({ postId, sceneCount: resolved.length }, '[RenderWorker] DynamicReel scenes resolved')
  return resolved
}

// ── renderReelVideo ────────────────────────────────────────────────────────────
// Shared bundle + render + R2 upload pipeline used by both slot-based and
// dynamic reel paths.

async function renderReelVideo({
  job,
  postId,
  brandId,
  templateId,
  renderJobId,
  remotionCompId,
  inputProps,
  startTime,
}: {
  job: Job<RenderJobData>
  postId: string
  brandId: string
  templateId: string | null
  renderJobId: string
  remotionCompId: string
  inputProps: Record<string, unknown>
  startTime: number
}): Promise<void> {
  ensureOutputDir()

  logger.info('[RenderWorker] Bundling Remotion composition...')
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

  const outputPath = path.join(OUTPUT_DIR, `render-${postId}.mp4`)
  logger.info(`[RenderWorker] Rendering video (${remotionComp.durationInFrames} frames)...`)
  await renderMedia({
    composition: remotionComp,
    serveUrl: bundleLocation,
    outputLocation: outputPath,
    inputProps,
    codec: 'h264',
    crf: 26,
    x264Preset: 'slow',
    audioBitrate: '128k',
    concurrency: CONCURRENCY,
    jpegQuality: 85,
    chromiumOptions: { gl: 'swangle' },
    ffmpegOverride: ({ type, args }) =>
      type === 'stitcher' ? [...args, '-pix_fmt', 'yuv420p', '-movflags', '+faststart'] : args,
    onProgress: ({ progress }) => {
      job.updateProgress(35 + Math.round(progress * 45)).catch(() => {})
    },
  })

  await job.updateProgress(80)
  logger.info('[RenderWorker] Uploading video to R2...')
  await prisma.renderJob.update({ where: { id: renderJobId }, data: { status: 'uploading' } })

  const videoR2Key = flownau.renderOutput(brandId, postId)
  const videoPublicUrl = await storage.upload(videoR2Key, fs.createReadStream(outputPath), {
    mimeType: 'video/mp4',
    cacheControl: 'no-store',
  })
  cleanupFile(outputPath)
  await job.updateProgress(90)

  // Extract cover frame — use midpoint of first scene
  let coverUrl: string | null = null
  const coverFrame = Math.min(Math.floor(remotionComp.durationInFrames / 2), remotionComp.durationInFrames - 1)
  const coverPath = path.join(OUTPUT_DIR, `cover-${postId}.jpg`)
  try {
    await renderStill({
      composition: remotionComp,
      serveUrl: bundleLocation,
      output: coverPath,
      inputProps,
      frame: coverFrame,
      imageFormat: 'jpeg',
      jpegQuality: 85,
      chromiumOptions: { gl: 'swangle' },
    })
    const coverR2Key = flownau.renderCover(brandId, postId)
    coverUrl = await storage.upload(coverR2Key, fs.createReadStream(coverPath), {
      mimeType: 'image/jpeg',
      cacheControl: 'no-store',
    })
    cleanupFile(coverPath)
  } catch (coverErr) {
    logError('[RenderWorker] Cover extraction failed, proceeding without cover', coverErr)
  }

  await job.updateProgress(95)
  const renderTimeMs = Date.now() - startTime
  await prisma.renderJob.update({
    where: { id: renderJobId },
    data: { status: 'done', progress: 100, outputUrl: videoPublicUrl, completedAt: new Date(), renderTimeMs },
  })
  await prisma.post.update({
    where: { id: postId },
    data: { videoUrl: videoPublicUrl, coverUrl, status: 'RENDERED_PENDING' },
  })
  await applyAutoApprovePost(postId, brandId, templateId)
  logger.info(`[RenderWorker] Video render complete: ${postId} (${renderTimeMs}ms)`)
}

async function processRenderJob(job: Job<RenderJobData>): Promise<void> {
  const { postId } = job.data
  const startTime = Date.now()

  logger.info(
    `[RenderWorker] Processing job ${job.id} for post ${postId} (attempt ${job.attemptsMade + 1})`,
  )

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { brand: true, template: true },
  })

  if (!post) throw new Error(`Post ${postId} not found in DB`)

  const renderJob = await prisma.renderJob.upsert({
    where: { postId },
    update: {
      status: 'rendering',
      attempts: job.attemptsMade + 1,
      startedAt: new Date(),
      error: null,
    },
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
  const USER_MANAGED_FORMATS = new Set(['head_talk', 'trial_head_talk', 'replicate'])
  if (USER_MANAGED_FORMATS.has(post.format ?? '') && post.userUploadedMediaUrl) {
    const renderTimeMs = Date.now() - startTime
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: {
        status: 'done',
        progress: 100,
        outputUrl: post.userUploadedMediaUrl,
        outputType: 'video',
        completedAt: new Date(),
        renderTimeMs,
      },
    })
    await prisma.post.update({
      where: { id: postId },
      data: { videoUrl: post.userUploadedMediaUrl, status: 'RENDERED_PENDING' },
    })
    await applyAutoApprovePost(postId, post.brandId, post.templateId)
    await job.updateProgress(100)
    logger.info(`[RenderWorker] Passthrough complete for ${postId} (${post.format})`)
    return
  }

  const format = post.format || 'reel'
  const isVideo = format === 'reel' || format === 'trial_reel'
  const brandId = post.brandId

  // Determine which Remotion composition to use
  const templateRemotionId = post.template?.remotionId ?? ''
  if (!isVideo || !VIDEO_REEL_IDS.has(templateRemotionId)) {
    throw new Error(
      `Post ${postId} has unsupported format/template: ${format}/${templateRemotionId}`,
    )
  }
  const remotionCompId = templateRemotionId
  const isDynamicReel = remotionCompId === DYNAMIC_REEL_ID

  // ── Build Remotion inputProps ─────────────────────────────────────────────────
  const creative = post.creative as Record<string, unknown> | null

  // ── Dynamic reel path ──────────────────────────────────────────────────────
  if (isDynamicReel) {
    const resolvedScenes = await resolveDynamicReelScenes(
      creative,
      post.brandId,
      postId,
      renderJob.id,
    )
    if (!resolvedScenes) return // error already written to DB

    const brandIdentity = (post.brand?.brandIdentity ?? {}) as BrandIdentity
    const inputProps: Record<string, unknown> = {
      scenes: resolvedScenes,
      audioUrl: (creative as any)?.audioUrl ?? undefined,
      brand: brandIdentity,
    }

    await job.updateProgress(20)
    await renderReelVideo({
      job,
      postId,
      brandId: post.brandId,
      templateId: post.templateId,
      renderJobId: renderJob.id,
      remotionCompId,
      inputProps,
      startTime,
    })
    return
  }

  // ── Legacy slot-based path ─────────────────────────────────────────────────
  if (!creative?.slots) {
    // Creative is missing or was composed with the legacy scene-composer.
    // Reset so the user can recompose via the calendar modal.
    await prisma.post.update({ where: { id: postId }, data: { status: 'DRAFT_PENDING' } })
    await prisma.renderJob.update({
      where: { id: renderJob.id },
      data: {
        status: 'failed',
        error: 'No slot creative — please recompose this post',
        completedAt: new Date(),
      },
    })
    logger.warn(
      { postId, templateRemotionId },
      '[RenderWorker] No slot creative — reset to DRAFT_PENDING',
    )
    return
  }

  type RenderSnapshot = { brollClips: Array<{ url: string; startFrom: number }>; audioUrl?: string }
  const savedSnapshot = (creative as Record<string, unknown>).renderSnapshot as
    | RenderSnapshot
    | undefined

  let brollClips: Array<{ url: string; startFrom: number }>
  let audioUrl: string | undefined
  let freshlyResolved = false

  if (savedSnapshot?.brollClips?.length) {
    brollClips = savedSnapshot.brollClips
    audioUrl = savedSnapshot.audioUrl
    logger.info({ postId }, '[RenderWorker] Using render snapshot for b-roll and audio')
  } else {
    const brollMood = Array.isArray(creative.brollMood)
      ? (creative.brollMood as string[]).join(', ')
      : String(creative.brollMood ?? '')
    const moodKeywords = brollMood
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const [allVideos, audioAssets] = await Promise.all([
      prisma.asset.findMany({
        where: { brandId, type: { in: ['video', 'VID'] } },
        select: { id: true, url: true, duration: true, tags: true, lastUsedAt: true },
        take: 50,
        orderBy: { lastUsedAt: { sort: 'asc', nulls: 'first' } },
      }),
      prisma.asset.findMany({
        where: { brandId, type: { in: ['audio', 'AUD'] } },
        select: { id: true, url: true, lastUsedAt: true },
        take: 50,
        orderBy: { lastUsedAt: { sort: 'asc', nulls: 'first' } },
      }),
    ])

    const longEnough = allVideos.filter(
      (a) => !a.duration || Math.floor(a.duration * REMOTION_FPS) >= BROLL_REQUIRED_FRAMES,
    )
    const candidatePool = longEnough.length > 0 ? longEnough : allVideos

    const moodMatched =
      moodKeywords.length > 0
        ? candidatePool.filter((a) => a.tags.some((t) => moodKeywords.includes(t.toLowerCase())))
        : []

    // LRU ordering: assets never used (null) first, then oldest-used first.
    // Applies within the mood-filtered pool (or full pool if no mood match).
    const orderedPool = (moodMatched.length > 0 ? moodMatched : candidatePool).sort((a, b) => {
      if (!a.lastUsedAt && !b.lastUsedAt) return 0
      if (!a.lastUsedAt) return -1
      if (!b.lastUsedAt) return 1
      return a.lastUsedAt.getTime() - b.lastUsedAt.getTime()
    })

    // Shuffle within the LRU candidate window (top 10 least-recently-used)
    // to prevent always selecting the exact same top-5 assets on every render.
    const LRU_WINDOW = 10
    const videoPool = shuffle(orderedPool.slice(0, LRU_WINDOW)).slice(0, 5)

    brollClips = videoPool.map((a) => {
      const assetFrames = a.duration ? Math.floor(a.duration * REMOTION_FPS) : 0
      const maxStart = Math.max(0, assetFrames - BROLL_REQUIRED_FRAMES)
      const startFrom = maxStart > 0 ? Math.floor(Math.random() * maxStart) : 0
      return { url: a.url, startFrom, durationInFrames: assetFrames > 0 ? assetFrames : undefined }
    })

    // Same shuffle approach for audio: pick from top-3 LRU candidates
    const audioPool = shuffle(audioAssets.slice(0, 3))
    const selectedAudio = audioPool[0]
    audioUrl = selectedAudio?.url
    freshlyResolved = true

    // Stamp selected assets so LRU ordering rotates them out next time
    const usedVideoIds = videoPool.map((a) => a.id)
    const usedAudioIds = selectedAudio ? [selectedAudio.id] : []
    const usedIds = [...usedVideoIds, ...usedAudioIds]
    if (usedIds.length > 0) {
      await prisma.asset.updateMany({
        where: { id: { in: usedIds } },
        data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
      })
    }

    logger.info(
      {
        postId,
        brandId,
        moodKeywords,
        videoPoolSize: orderedPool.length,
        selectedClipCount: videoPool.length,
        hasAudio: !!audioUrl,
      },
      '[RenderWorker] B-roll and audio assets resolved',
    )
  }

  const selectedClips = brollClips.slice(0, 5)

  if (freshlyResolved) {
    await prisma.post.update({
      where: { id: postId },
      data: {
        creative: {
          ...(creative as object),
          renderSnapshot: { brollClips: selectedClips, audioUrl },
        },
      },
    })
  }
  const brandIdentity = (post.brand?.brandIdentity ?? {}) as BrandIdentity

  const inputProps: Record<string, unknown> = {
    slots: creative.slots,
    caption: creative.caption ?? '',
    hashtags: creative.hashtags ?? [],
    brollClips: selectedClips,
    audioUrl,
    brand: brandIdentity,
  }

  await job.updateProgress(20)
  await renderReelVideo({
    job,
    postId,
    brandId,
    templateId: post.templateId,
    renderJobId: renderJob.id,
    remotionCompId,
    inputProps,
    startTime,
  })
  await job.updateProgress(100)
}


function handleFailedJob(job: Job<RenderJobData> | undefined, error: Error): void {
  if (!job) return
  const { postId } = job.data

  logError(`[RenderWorker] Job ${job.id} failed`, error)

  if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
    prisma.renderJob
      .update({
        where: { postId },
        data: { status: 'failed', error: error.message, completedAt: new Date() },
      })
      .then(() => prisma.post.update({ where: { id: postId }, data: { status: 'DRAFT_PENDING' } }))
      .catch((dbErr) => logError('[RenderWorker] Failed to update failed status in DB', dbErr))
  }
}

export function startRenderWorker(): Worker<RenderJobData> {
  const worker = new Worker<RenderJobData>('flownau-render', processRenderJob, {
    connection: redisConnection,
    concurrency: 1,
    limiter: { max: 5, duration: 60_000 },
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

import { fileURLToPath } from 'node:url'
import { startOptimizationWorker } from '@/modules/asset/optimization-worker'
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  logger.info('[RenderWorker] Starting standalone render worker...')
  startRenderWorker()
  startOptimizationWorker()
}
