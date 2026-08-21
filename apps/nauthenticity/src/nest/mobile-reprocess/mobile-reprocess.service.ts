import { Injectable, NotFoundException } from '@nestjs/common';
import { mobileReprocessQueue } from '../../queues/mobile-reprocess.queue';

@Injectable()
export class MobileReprocessService {
  async enqueue(url: string) {
    const job = await mobileReprocessQueue.add('reprocess-capture', { url });
    return { status: 'accepted', jobId: job.id };
  }

  async getStatus(jobId: string) {
    const job = await mobileReprocessQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Job not found');
    const state = await job.getState();
    return {
      id: job.id,
      state,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }
}
