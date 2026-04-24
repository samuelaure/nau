import { Worker, Job } from 'bullmq';
import { connection } from '../queues/connection.js';
import { OUTBOUND_QUEUE_NAME } from '../queues/outbound.queue.js';
import { ProviderFactory } from '../../core/providers/ProviderFactory.js';
import { logger } from '../../core/logger.js';
import { db } from '../../core/db.js';
import { withErrorBoundary } from '../../core/resilience/ErrorBoundary.js';

interface OutboundJobData {
  campaignId: string | undefined;
  phoneNumber: string;
  type: 'text' | 'template' | 'interactive';
  payload: any;
  messageId?: string;
  leadId?: string;
  tenantId?: string;
  correlationId?: string;
}

const worker = new Worker<OutboundJobData>(
  OUTBOUND_QUEUE_NAME,
  async (job: Job<OutboundJobData>) => {
    return withErrorBoundary(
      async () => {
        const { campaignId, phoneNumber, type, payload, leadId, messageId, tenantId, correlationId } =
          job.data;

        logger.info(
          { jobId: job.id, leadId, tenantId, type, phoneNumber, correlationId },
          'Worker: Processing outbound message'
        );

        try {
          // If tenantId is missing (legacy job?), try to resolve or fail gracefully
          if (!tenantId) {
            throw new Error('Tenant ID missing in outbound job');
          }

          const provider = ProviderFactory.getProvider(tenantId, campaignId);
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

          // Mark as failed in DB immediately
          if (messageId) {
            await db.message
              .update({
                where: { id: messageId },
                data: { status: 'failed' },
              })
              .catch(() => { }); // Best effort
          }

          throw error;
        }
      },
      {
        category: 'WORKER_OUTBOUND',
        severity: 'WARN',
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
  logger.error({ jobId: job?.id, err }, 'Outbound worker job failed');
  // SystemAlert is already handled by ErrorBoundary
});

export const outboundWorker = worker;
