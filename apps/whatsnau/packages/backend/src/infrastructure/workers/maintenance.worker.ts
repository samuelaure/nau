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
      await handleLeadRecovery();
    }
  },
  { connection }
);

async function handleLeadRecovery() {
  logger.info('Starting Lead Recovery check...');

  // 1. Find leads in HANDOVER status
  const handoverLeads = await db.lead.findMany({
    where: { status: 'HANDOVER' },
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

  for (const lead of handoverLeads) {
    const lastMessage = lead.messages[0];
    if (!lastMessage || lastMessage.direction === 'OUTBOUND') {
      // If the last message was outbound, a human responded. Handover is valid.
      continue;
    }

    // 2. Determine timeout
    const config = lead.tenant.globalConfigs[0] as any;
    const timeoutMinutes = config?.recoveryTimeoutMinutes || 240; // Default 4 hours
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const lastInboundAt = lead.lastInboundAt || lastMessage.timestamp;
    const timeSinceLastInbound = Date.now() - new Date(lastInboundAt).getTime();

    if (timeSinceLastInbound > timeoutMs) {
      logger.info(
        { leadId: lead.id, tenantId: lead.tenantId },
        'Lead recovery triggered: Timeout exceeded'
      );

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
        'Sigues ahí? He notificado a mi equipo humano pero están algo ocupados ahora mismo. En qué más puedo ayudarte mientras tanto?';

      await Orchestrator.sendAsync(
        lead,
        'text',
        { body: bridgeMsg },
        bridgeMsg,
        lead.currentStage?.name || lead.state,
        true
      );
    }
  }
}

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Maintenance worker job failed');
});

export const maintenanceWorker = worker;
