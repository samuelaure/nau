import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ingestionQueue } from '../../queues/ingestion.queue'
import { downloadQueue } from '../../queues/download.queue'
import { computeQueue } from '../../queues/compute.queue'
import { abortActorRun } from '../../services/apify.service'
import { PipelineStepName, PHASE_LABELS } from '../../queues/compute.worker'

@Injectable()
export class IngestionService {
  constructor(private readonly prisma: PrismaService) {}

  async queueIngestion(username: string, limit: number, updateSync?: boolean) {
    const jobs = await ingestionQueue.getJobs(['active', 'waiting', 'delayed'])
    const existing = jobs.find((j) => j.data.username === username)
    if (existing) {
      throw new ConflictException({
        error: 'Conflict',
        message: `An ingestion job for ${username} is already in progress`,
        jobId: existing.id,
      })
    }
    const job = await ingestionQueue.add('start-ingestion', { username, limit, updateSync })
    return { status: 'accepted', jobId: job.id, message: `Ingestion job queued for ${username}` }
  }

  async abort(username: string) {
    for (const q of [ingestionQueue, downloadQueue, computeQueue]) {
      const jobs = await q.getJobs(['active', 'waiting', 'delayed'])
      await Promise.all(jobs.filter((j) => j.data.username === username).map((j) => j.remove()))
    }
    const run = await this.prisma.scrapingRun.findFirst({
      where: { username, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    if (run?.actorRunId) {
      await abortActorRun(run.actorRunId)
      await this.prisma.scrapingRun.update({ where: { id: run.id }, data: { status: 'failed' } })
    }
    return { status: 'aborted', message: `All jobs for ${username} have been requested to stop.` }
  }

  async pause(username: string) {
    const run = await this.prisma.scrapingRun.findFirst({
      where: { username, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    if (!run) throw new NotFoundException('No active run for this user')
    await this.prisma.scrapingRun.update({ where: { id: run.id }, data: { isPaused: true } })
    return { status: 'paused' }
  }

  async resume(username: string) {
    const run = await this.prisma.scrapingRun.findFirst({
      where: { username, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    if (!run) throw new NotFoundException('No active run for this user')
    await this.prisma.scrapingRun.update({ where: { id: run.id }, data: { isPaused: false } })

    const { phase, id: runId } = run
    if (phase === 'downloading') {
      // Only re-queue media where storageUrl still equals the original CDN/source url
      // (i.e. not yet moved to our own storage). storageUrl !== url means already downloaded.
      const allMedia = await this.prisma.media.findMany({ where: { post: { runId } } })
      const pendingMedia = allMedia.filter((m) => m.storageUrl === m.url)
      for (const m of pendingMedia) {
        await downloadQueue.add('process-media', {
          postId: m.postId,
          mediaId: m.id,
          runId,
          url: m.url,
          type: m.type,
          username,
        })
      }
    } else if (phase === 'transcribing') {
      // Guard: skip re-queuing if all video media already have transcripts — prevents duplicate Whisper calls
      const videoMedia = await this.prisma.media.findMany({
        where: { post: { runId }, type: 'video' },
        include: { transcript: true },
      })
      const needsTranscription = videoMedia.filter((m) => !m.transcript)
      if (needsTranscription.length === 0) {
        // All done — advance to next step
        await this.prisma.scrapingRun.update({ where: { id: run.id }, data: { phase: 'embedding' } })
        await computeQueue.add('embed-batch', { runId, username })
      } else {
        await computeQueue.add('transcribe-batch', { runId, username })
      }
    } else {
      const stepName = (Object.keys(PHASE_LABELS) as PipelineStepName[]).find(
        (k) => PHASE_LABELS[k] === phase,
      )
      if (stepName) await computeQueue.add(stepName, { runId, username })
    }

    return { status: 'resumed', phase }
  }

  async getJobStatus(jobId: string) {
    const job = await ingestionQueue.getJob(jobId)
    if (!job) throw new NotFoundException('Job not found')
    const state = await job.getState()
    return {
      id: job.id,
      state,
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
    }
  }
}
