import { db } from '../db.js';
import { logger } from '../logger.js';
import { LeadService } from '../../services/lead.service.js';
import { EventsService } from '../../services/events.service.js';
import { MessageBufferService } from '../../services/buffer.service.js';
import { maintenanceQueue } from '../../infrastructure/queues/maintenance.queue.js';
import { getCorrelationId } from '../observability/CorrelationId.js';

/**
 * MessageRouter - Handles initial message routing, persistence, and tenant resolution
 */
export class MessageRouter {
  /**
   * Resolve Tenant ID from phoneNumberId (from WhatsApp payload)
   */
  static async resolveTenantId(phoneNumberId?: string): Promise<string | undefined> {
    if (!phoneNumberId) return undefined;

    try {
      const config = await db.whatsAppConfig.findUnique({
        where: { phoneNumberId },
        select: { tenantId: true },
      });
      return config?.tenantId;
    } catch (error) {
      logger.error({ err: error, phoneNumberId }, 'Failed to resolve tenant ID');
      return undefined;
    }
  }

  /**
   * Find an existing lead or create a new one for a given tenant
   */
  static async findOrInitializeLead(phoneNumber: string, tenantId?: string) {
    if (!phoneNumber) return null;

    try {
      let lead;

      if (tenantId) {
        lead = await db.lead.findUnique({
          where: {
            tenantId_phoneNumber: {
              tenantId,
              phoneNumber,
            },
          },
          include: {
            campaign: { include: { stages: { orderBy: { order: 'asc' } } } },
            tags: true,
            currentStage: true,
          },
        });
      } else {
        // Fallback for legacy/loose lookup
        lead = await db.lead.findFirst({
          where: { phoneNumber },
          include: {
            campaign: { include: { stages: { orderBy: { order: 'asc' } } } },
            tags: true,
            currentStage: true,
          },
        });
      }

      if (!lead && tenantId) {
        const campaign = await db.campaign.findFirst({
          where: { tenantId, isActive: true },
        });

        if (!campaign) {
          logger.warn({ tenantId }, 'No active campaign found for tenant');
          return null;
        }

        const initialLead = await LeadService.initiateLead(phoneNumber, campaign.id);
        lead = await db.lead.findUnique({
          where: { id: initialLead.id },
          include: {
            campaign: { include: { stages: { orderBy: { order: 'asc' } } } },
            tags: true,
            currentStage: true,
          },
        });
      }

      return lead;
    } catch (error) {
      logger.error({ err: error, phoneNumber, tenantId }, 'Failed to find or initialize lead');
      return undefined;
    }
  }

  /**
   * Persist message to database
   */
  static async persistMessage(params: {
    leadId: string;
    direction: 'INBOUND' | 'OUTBOUND';
    content: string;
    whatsappId?: string;
    type: 'TEXT' | 'BUTTON_RESPONSE';
    stageName?: string;
    aiGenerated?: boolean;
    isProcessed?: boolean;
  }) {
    try {
      return await db.message.upsert({
        where: { whatsappId: params.whatsappId || 'unknown' },
        create: {
          leadId: params.leadId,
          direction: params.direction,
          content: params.content,
          whatsappId: params.whatsappId,
          type: params.type,
          campaignStage: params.stageName,
          isProcessed: params.isProcessed ?? params.direction === 'OUTBOUND',
          aiGenerated: params.aiGenerated ?? false,
        },
        update: {
          content: params.content,
        },
      });
    } catch (error) {
      // Handle idempotency (P2002 is Prisma unique constraint error)
      if ((error as any).code === 'P2002') {
        logger.info(
          { whatsappId: params.whatsappId },
          'Message already exists, ignoring duplicate'
        );
        return null;
      }
      logger.error({ err: error, whatsappId: params.whatsappId }, 'Failed to persist message');
      throw error;
    }
  }

  /**
   * Handle SILENT TAKEOVER & REACTIVATION triggers
   */
  static async handleOutboundTakeover(lead: any, whatsappId?: string, content?: string) {
    if (!whatsappId || whatsappId === 'pending') return;

    // 1. Avoid self-handover for AI messages
    const existingMessage = await db.message.findUnique({
      where: { whatsappId },
      select: { aiGenerated: true },
    });

    if (existingMessage?.aiGenerated) return;

    const normalizedContent = content?.toUpperCase().trim() || '';
    const tenantId = lead.tenantId;

    // 2. Resolve keywords
    const keywords = await db.takeoverKeyword.findMany({
      where: { tenantId, type: 'INTERNAL' },
    });

    const isReactivation = keywords
      .filter((k) => k.category === 'REACTIVATION')
      .some((k) => normalizedContent.includes(k.word.toUpperCase()));

    if (isReactivation) {
      await db.lead.update({
        where: { id: lead.id },
        data: { status: 'ACTIVE', aiEnabled: true },
      });
      logger.info(
        { leadId: lead.id, correlationId: getCorrelationId() },
        'AI Agent reactivated by owner'
      );
      return;
    }

    const isExplicitTakeover = keywords
      .filter((k) => k.category === 'TAKEOVER')
      .some((k) => normalizedContent.includes(k.word.toUpperCase()));

    // 3. Trigger Handover
    if (lead.status !== 'HANDOVER' || isExplicitTakeover) {
      await db.lead.update({
        where: { id: lead.id },
        data: { status: 'HANDOVER' },
      });
      logger.info(
        { leadId: lead.id, correlationId: getCorrelationId() },
        'Handover triggered: Manual message detected'
      );

      // Schedule Recovery
      const config = (await db.globalConfig.findUnique({
        where: { tenantId: lead.tenantId },
      })) as any;
      const delayMinutes = config?.recoveryTimeoutMinutes || 240;

      await maintenanceQueue.add(
        'lead-recovery',
        { leadId: lead.id, tenantId: lead.tenantId },
        { delay: delayMinutes * 60 * 1000, jobId: `recovery-${lead.id}` }
      );
    }
  }

  /**
   * Update message delivery status
   */
  static async handleStatusUpdate(whatsappId: string, status: string) {
    logger.info({ whatsappId, status }, 'Updating message status');
    try {
      await db.message.update({
        where: { whatsappId },
        data: {
          status,
          ...(status === 'read' ? { wasRead: true } : {}),
        },
      });

      EventsService.emit('status', { whatsappId, status });
    } catch (error) {
      logger.error({ err: error, whatsappId }, 'Failed to update message status');
    }
  }
}
