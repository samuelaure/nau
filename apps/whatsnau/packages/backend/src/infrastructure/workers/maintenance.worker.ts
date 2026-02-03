import { Worker, Job } from 'bullmq';
import { connection } from '../queues/connection.js';
import { MAINTENANCE_QUEUE_NAME } from '../queues/maintenance.queue.js';
import { db } from '../../core/db.js';
import { logger } from '../../core/logger.js';
import { Orchestrator } from '../../core/orchestrator.js';

const worker = new Worker(
  MAINTENANCE_QUEUE_NAME,
  async (job: Job) => {
    if (job.name === 'lead-recovery') {
      const { leadId, tenantId } = job.data;
      await handleSingleLeadRecovery(leadId, tenantId);
    }
  },
  { connection }
);

async function handleSingleLeadRecovery(leadId: string, tenantId: string) {
  logger.info({ leadId, tenantId }, 'Processing targeted Lead Recovery...');

  // 1. Fetch targeted lead
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      tenant: {
        include: {
          globalConfigs: true,
        },
      },
      currentStage: true,
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
  });

  if (!lead || lead.status !== 'HANDOVER') {
    logger.info({ leadId }, 'Lead recovery skipped: Lead not in HANDOVER state or not found');
    return;
  }

  const lastMessage = lead.messages[0];
  if (lastMessage && lastMessage.direction === 'OUTBOUND') {
    // If the last message was outbound, a human responded. Handover recovery cancelled.
    logger.info({ leadId }, 'Lead recovery skipped: Human already responded');
    return;
  }

  // 2. Determine timeout (Double check if still valid)
  const config = lead.tenant.globalConfigs[0] as any;
  const timeoutMinutes = config?.recoveryTimeoutMinutes || 240;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const lastInboundAt =
    lead.lastInboundAt || (lastMessage ? lastMessage.timestamp : lead.createdAt);
  const timeSinceLastInbound = Date.now() - new Date(lastInboundAt).getTime();

  // We add a small buffer (5s) to avoid race conditions with BullMQ accuracy
  if (timeSinceLastInbound >= timeoutMs - 5000) {
    logger.info({ leadId }, 'Lead recovery triggered: Reactivating AI agent');

    // 3. Reactivate AI
    await db.lead.update({
      where: { id: lead.id },
      data: {
        status: 'ACTIVE',
        aiEnabled: true,
      },
    });

    // 4. Send a bridge message
    const bridgeMsg =
      '¿Sigues ahí? He notificado a mi equipo humano pero están ocupados ahora mismo. ¿En qué más puedo ayudarte mientras tanto?';

    await Orchestrator.sendAsync(
      lead,
      'text',
      { body: bridgeMsg },
      bridgeMsg,
      lead.currentStage?.name || lead.state,
      true
    );
  } else {
    logger.info(
      { leadId, timeSinceLastInbound, timeoutMs },
      'Lead recovery skipped: Timeout not yet reached'
    );
  }
}

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Maintenance worker job failed');
});

export const maintenanceWorker = worker;
