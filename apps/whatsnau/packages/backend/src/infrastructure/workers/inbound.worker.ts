import { Worker, Job } from 'bullmq';
import { connection } from '../queues/connection.js';
import { INBOUND_QUEUE_NAME } from '../queues/inbound.queue.js';
import { Orchestrator } from '../../core/orchestrator.js';
import { logger } from '../../core/logger.js';
import { StandardMessageEvent } from '../../core/providers/IWhatsAppProvider.js';

interface InboundJobData {
  event: StandardMessageEvent;
}

const worker = new Worker<InboundJobData>(
  INBOUND_QUEUE_NAME,
  async (job: Job<InboundJobData>) => {
    const { event } = job.data;
    logger.info({ jobId: job.id, eventType: event.type }, 'Worker: Processing inbound webhook');

    try {
      if (event.type === 'message') {
        const { from, payload, id, metadata, direction } = event;

        await Orchestrator.handleIncoming(
          from,
          payload.text,
          payload.buttonId,
          direction,
          id,
          metadata?.phoneNumberId
        );
      } else if (event.type === 'status') {
        await Orchestrator.handleStatusUpdate(event.id, event.payload.status);
      }
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, 'Worker: Failed to process inbound event');
      throw error;
    }
  },
  { connection }
);

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Inbound worker job failed');
});

export const inboundWorker = worker;
