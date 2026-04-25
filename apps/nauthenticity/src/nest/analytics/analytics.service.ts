import { Injectable } from '@nestjs/common'
import { ingestionQueue } from '../../queues/ingestion.queue'
import { downloadQueue } from '../../queues/download.queue'
import { computeQueue } from '../../queues/compute.queue'
import type { Job } from 'bullmq'

const formatJob = (j: Job) => ({
  id: j.id,
  name: j.name,
  data: j.data,
  timestamp: j.timestamp,
  failedReason: j.failedReason,
  progress: typeof j.progress === 'object' ? (j.progress as Record<string, unknown>).progress : j.progress,
  progressData: typeof j.progress === 'object' ? j.progress : {},
  processedOn: j.processedOn,
  finishedOn: j.finishedOn,
  opts: j.opts,
  attemptsMade: j.attemptsMade,
})

@Injectable()
export class AnalyticsService {
  async getQueueStatus() {
    const [dCounts, dActive, dWaiting, dFailed, cCounts, cActive, cWaiting, cFailed, iCounts, iActive, iWaiting, iFailed] =
      await Promise.all([
        downloadQueue.getJobCounts(),
        downloadQueue.getActive(0, 50),
        downloadQueue.getWaiting(0, 50),
        downloadQueue.getFailed(0, 50),
        computeQueue.getJobCounts(),
        computeQueue.getActive(0, 50),
        computeQueue.getWaiting(0, 50),
        computeQueue.getFailed(0, 50),
        ingestionQueue.getJobCounts(),
        ingestionQueue.getActive(0, 50),
        ingestionQueue.getWaiting(0, 50),
        ingestionQueue.getFailed(0, 50),
      ])
    return {
      download: { counts: dCounts, active: dActive.map(formatJob), waiting: dWaiting.map(formatJob), failed: dFailed.map(formatJob) },
      compute: { counts: cCounts, active: cActive.map(formatJob), waiting: cWaiting.map(formatJob), failed: cFailed.map(formatJob) },
      ingestion: { counts: iCounts, active: iActive.map(formatJob), waiting: iWaiting.map(formatJob), failed: iFailed.map(formatJob) },
    }
  }

  async retryFailed(queueName?: string) {
    if (queueName === 'ingestion') await ingestionQueue.retryJobs()
    else if (queueName === 'download') await downloadQueue.retryJobs()
    else if (queueName === 'compute') await computeQueue.retryJobs()
    else await Promise.all([ingestionQueue.retryJobs(), downloadQueue.retryJobs(), computeQueue.retryJobs()])
    return { status: 'ok', message: 'Failed jobs retried' }
  }

  async clearFailed(queueName?: string) {
    if (queueName === 'ingestion') await ingestionQueue.clean(0, 0, 'failed')
    else if (queueName === 'download') await downloadQueue.clean(0, 0, 'failed')
    else if (queueName === 'compute') await computeQueue.clean(0, 0, 'failed')
    else await Promise.all([ingestionQueue.clean(0, 0, 'failed'), downloadQueue.clean(0, 0, 'failed'), computeQueue.clean(0, 0, 'failed')])
    return { status: 'ok', message: 'Failed jobs cleared' }
  }

  async deleteJob(queueName: string, jobId: string) {
    let job: Job | undefined
    if (queueName === 'ingestion') job = (await ingestionQueue.getJob(jobId)) ?? undefined
    else if (queueName === 'download') job = (await downloadQueue.getJob(jobId)) ?? undefined
    else if (queueName === 'compute') job = (await computeQueue.getJob(jobId)) ?? undefined
    if (!job) return null
    await job.remove()
    return { status: 'ok', message: 'Job removed' }
  }
}
