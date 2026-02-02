import { Worker, Job } from 'bullmq';
import { connection } from '../queues/connection.js';
import { OUTBOUND_QUEUE_NAME } from '../queues/outbound.queue.js';
import { ProviderFactory } from '../../core/providers/ProviderFactory.js';
import { logger } from '../../core/logger.js';

import { db } from '../../core/db.js';

interface OutboundJobData {
  campaignId: string | undefined;
  phoneNumber: string;
  type: 'text' | 'template' | 'interactive';
  payload: any;
  messageId?: string;
  leadId?: string;
}

const worker = new Worker<OutboundJobData>(
  OUTBOUND_QUEUE_NAME,
  async (job: Job<OutboundJobData>) => {
    const { campaignId, phoneNumber, type, payload, leadId, messageId } = job.data;

    logger.info(
      { jobId: job.id, leadId, type, phoneNumber },
      'Worker: Processing outbound message'
    );

    try {
      const provider = ProviderFactory.getProvider(campaignId);
      const whatsappId = await provider.sendMessage(phoneNumber, type, payload);

      logger.info({ jobId: job.id, whatsappId }, 'Worker: Message sent successfully');

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
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, 'Worker: Failed to send outbound message');
      throw error;
    }
  },
  { connection }
);

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Outbound worker job failed');
});

export const outboundWorker = worker;
