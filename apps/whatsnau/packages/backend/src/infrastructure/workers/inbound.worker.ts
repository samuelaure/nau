import { Worker, Job } from 'bullmq';
import { connection } from '../queues/connection.js';
import { INBOUND_QUEUE_NAME } from '../queues/inbound.queue.js';
import { Orchestrator } from '../../core/orchestrator.js';
import { logger } from '../../core/logger.js';
import { StandardMessageEvent } from '../../core/providers/IWhatsAppProvider.js';
import { db } from '../../core/db.js';
import { NotificationService } from '../../services/notification.service.js';

interface InboundJobData {
  event: StandardMessageEvent;
  correlationId?: string;
}

const worker = new Worker<InboundJobData>(
  INBOUND_QUEUE_NAME,
  async (job: Job<InboundJobData>) => {
    const { event, correlationId } = job.data;
    logger.info(
      { jobId: job.id, eventType: event.type, correlationId },
      'Worker: Processing inbound webhook'
    );

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
    } catch (error: any) {
      logger.error(
        { err: error, jobId: job.id, correlationId, attemptsMade: job.attemptsMade },
        'Worker: Failed to process inbound event'
      );

      if (job.attemptsMade >= 3) {
        await NotificationService.notifySystemError('CRITICAL', {
          category: 'WORKER_INBOUND_EXHAUSTED',
          message: 'Inbound worker exhausted retries',
          error,
          jobId: job.id,
        });
      }

      throw error;
    }
  },
  { connection }
);

worker.on('failed', async (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Inbound worker job failed');

  // Log to SystemAlert table
  try {
    await db.systemAlert.create({
      data: {
        severity: 'CRITICAL',
        category: 'WORKER_INBOUND_FAILED',
        message: err.message,
        context: {
          jobId: job?.id,
          data: job?.data as any,
          stack: err.stack,
        },
      },
    });
  } catch (alertErr) {
    logger.error({ err: alertErr }, 'Failed to log inbound worker failure to SystemAlert');
  }
});

export const inboundWorker = worker;
