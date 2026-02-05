import { Worker, Job } from 'bullmq';
import { connection } from '../queues/connection.js';
import { INBOUND_QUEUE_NAME } from '../queues/inbound.queue.js';
import { Orchestrator } from '../../core/orchestrator.js';
import { logger } from '../../core/logger.js';
import { StandardMessageEvent } from '../../core/providers/IWhatsAppProvider.js';
import { db } from '../../core/db.js';
import { withErrorBoundary } from '../../core/resilience/ErrorBoundary.js';

interface InboundJobData {
  event: StandardMessageEvent;
  correlationId?: string;
}

const worker = new Worker<InboundJobData>(
  INBOUND_QUEUE_NAME,
  async (job: Job<InboundJobData>) => {
    return withErrorBoundary(
      async () => {
        const { event, correlationId } = job.data;
        logger.info(
          { jobId: job.id, eventType: event.type, correlationId },
          'Worker: Processing inbound webhook'
        );

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
      },
      {
        category: 'WORKER_INBOUND',
        severity: 'CRITICAL',
        rethrow: true, // Allow BullMQ to handle retries
        metadata: {
          jobId: job.id,
          correlationId: job.data.correlationId,
          attemptsMade: job.attemptsMade,
        },
      }
    );
  },
  { connection }
);

worker.on('failed', async (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Inbound worker job failed');
  // SystemAlert is already handled by ErrorBoundary
});

export const inboundWorker = worker;
