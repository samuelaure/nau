import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ingestionWorker } from '../../queues/ingestion.worker'
import { downloadWorker } from '../../queues/download.worker'
import { computeWorker } from '../../queues/compute.worker'
import { optimizationWorker } from '../../queues/optimization.worker'
import { optimizationQueue } from '../../queues/optimization.queue'
import { computeQueue } from '../../queues/compute.queue'
import { prisma } from '../../modules/shared/prisma'

@Injectable()
export class WorkersService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkersService.name)
  private readonly workers = [ingestionWorker, downloadWorker, computeWorker, optimizationWorker]

  async onApplicationBootstrap() {
    this.logger.log('Starting BullMQ workers...')
    await Promise.all(this.workers.map((w) => w.waitUntilReady()))
    this.logger.log('All BullMQ workers ready')
    await this.recoverStuckRuns()
  }

  async onApplicationShutdown() {
    this.logger.log('Closing BullMQ workers...')
    await Promise.all(this.workers.map((w) => w.close()))
    this.logger.log('All BullMQ workers closed')
  }

  // Recover runs that were left in a transitional phase due to a worker crash/restart.
  private async recoverStuckRuns() {
    try {
      // Runs stuck in 'downloading': all media uploaded but transition to 'optimizing' never fired.
      const stuckInDownloading = await prisma.scrapingRun.findMany({
        where: { phase: 'downloading' },
        include: { posts: { include: { media: true } } },
      })

      for (const run of stuckInDownloading) {
        const allMedia = run.posts.flatMap((p) => p.media)
        if (allMedia.length === 0) continue

        const uploaded = allMedia.filter((m) => m.storageUrl)
        if (uploaded.length < allMedia.length) continue // still genuinely downloading

        const username = run.posts[0]?.username
        if (!username) continue

        this.logger.warn(`[Recovery] Run ${run.id} stuck in downloading — re-triggering optimization`)

        await prisma.scrapingRun.update({ where: { id: run.id }, data: { phase: 'optimizing' } })

        const rawMedia = allMedia.filter((m) => m.storageUrl?.includes('/raw/'))
        if (rawMedia.length > 0) {
          for (const m of rawMedia) {
            await optimizationQueue.add(
              'optimize-media',
              {
                runId: run.id,
                mediaId: m.id,
                username,
                rawUrl: m.storageUrl,
                type: m.type as 'image' | 'video',
                fileExt: m.type === 'video' ? 'mp4' : 'jpg',
              },
              { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
            )
          }
        } else {
          await prisma.scrapingRun.update({ where: { id: run.id }, data: { phase: 'visualizing' } })
          await computeQueue.add('visualize-batch', { runId: run.id, username })
        }
      }

      // Runs stuck in 'optimizing': all media optimized but compute/visualize never fired.
      const stuckInOptimizing = await prisma.scrapingRun.findMany({
        where: { phase: 'optimizing' },
        include: { posts: { include: { media: true } } },
      })

      for (const run of stuckInOptimizing) {
        const allMedia = run.posts.flatMap((p) => p.media)
        if (allMedia.length === 0) continue

        const stillRaw = allMedia.filter((m) => m.storageUrl?.includes('/raw/'))
        if (stillRaw.length > 0) continue // still genuinely optimizing

        const username = run.posts[0]?.username
        if (!username) continue

        this.logger.warn(`[Recovery] Run ${run.id} stuck in optimizing — re-triggering visualize`)
        await prisma.scrapingRun.update({ where: { id: run.id }, data: { phase: 'visualizing' } })
        await computeQueue.add('visualize-batch', { runId: run.id, username })
      }

      // Runs stuck in 'transcribing': worker crashed mid-transcription.
      // Re-queue only if there are still videos without transcripts — prevents duplicate Whisper calls on restart.
      const stuckInTranscribing = await prisma.scrapingRun.findMany({
        where: { phase: 'transcribing', status: 'pending', isPaused: false },
        include: { posts: { include: { media: { include: { transcript: true } } } } },
      })

      for (const run of stuckInTranscribing) {
        const username = run.posts[0]?.username
        if (!username) continue

        const videoMedia = run.posts.flatMap((p) => p.media).filter((m) => m.type === 'video')
        const needsTranscription = videoMedia.filter((m) => !m.transcript)

        if (needsTranscription.length === 0) {
          this.logger.warn(`[Recovery] Run ${run.id} stuck in transcribing but all done — advancing to embedding`)
          await prisma.scrapingRun.update({ where: { id: run.id }, data: { phase: 'embedding' } })
          await computeQueue.add('embed-batch', { runId: run.id, username })
        } else {
          this.logger.warn(`[Recovery] Run ${run.id} stuck in transcribing — re-queuing (${needsTranscription.length} videos remaining)`)
          await computeQueue.add('transcribe-batch', { runId: run.id, username })
        }
      }
    } catch (err) {
      this.logger.error(`[Recovery] Startup recovery failed: ${err}`)
    }
  }
}
