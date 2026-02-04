import { Worker, Job } from 'bullmq';
import { connection } from '../queues/connection.js';
import { OUTBOUND_QUEUE_NAME } from '../queues/outbound.queue.js';
import { ProviderFactory } from '../../core/providers/ProviderFactory.js';
import { logger } from '../../core/logger.js';
import { db } from '../../core/db.js';
import { NotificationService } from '../../services/notification.service.js';

interface OutboundJobData {
  campaignId: string | undefined;
  phoneNumber: string;
  type: 'text' | 'template' | 'interactive';
  payload: any;
  messageId?: string;
  leadId?: string;
  correlationId?: string;
}

const worker = new Worker<OutboundJobData>(
  OUTBOUND_QUEUE_NAME,
  async (job: Job<OutboundJobData>) => {
    const { campaignId, phoneNumber, type, payload, leadId, messageId, correlationId } = job.data;

    logger.info(
      { jobId: job.id, leadId, type, phoneNumber, correlationId },
      'Worker: Processing outbound message'
    );

    try {
      const provider = ProviderFactory.getProvider(campaignId);
      const whatsappId = await provider.sendMessage(phoneNumber, type, payload);

      logger.info(
        { jobId: job.id, whatsappId, correlationId },
        'Worker: Message sent successfully'
      );

      if (messageId) {
        await db.message.update({
          where: { id: messageId },
          data: {
            whatsappId: whatsappId,
            status: 'sent',
          },
        });
      }

      return { whatsappId };
    } catch (error: any) {
      logger.error(
        { err: error, jobId: job.id, correlationId, attempts: job.attemptsMade },
        'Worker: Failed to send outbound message'
      );

      // Handle retry exhaustion
      if (job.attemptsMade >= 3) {
        logger.error(
          { jobId: job.id, messageId, leadId },
          'Worker: Outbound job exhausted all retries'
        );

        if (messageId) {
          await db.message.update({
            where: { id: messageId },
            data: { status: 'failed' },
          });
        }

        if (leadId) {
          await NotificationService.notifyMessageFailure(leadId, error);
        }
      }

      throw error;
    }
  },
  { connection }
);

worker.on('failed', async (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Outbound worker job failed');

  // Log to SystemAlert table
  try {
    await db.systemAlert.create({
      data: {
        severity: 'WARN',
        category: 'WORKER_OUTBOUND_FAILED',
        message: err.message,
        context: {
          jobId: job?.id,
          data: job?.data as any,
          stack: err.stack,
        },
      },
    });
  } catch (alertErr) {
    logger.error({ err: alertErr }, 'Failed to log worker failure to SystemAlert');
  }
});

export const outboundWorker = worker;
