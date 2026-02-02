import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { WhatsAppService } from './whatsapp.service.js';
import { LeadService, LeadState } from './lead.service.js';
import { TemplateService } from './template.service.js';

export class SequenceService {
  /**
   * Main entry point for sequence processing
   */
  static async processFollowUps() {
    logger.info('Running sequence processor...');

    // 1. Process all active campaigns
    const activeCampaigns = await db.campaign.findMany({
      where: { isActive: true },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    for (const campaign of activeCampaigns) {
      await this.processCampaignLeads(campaign);
    }

    // 2. Global background processes
    await this.processNurturingOnboarding();
    await this.processHandoverFollowUps();
  }

  /**
   * Process all leads for a specific campaign
   */
  private static async processCampaignLeads(campaign: any) {
    // Get COLD leads in this specific campaign
    const leads = await db.lead.findMany({
      where: {
        campaignId: campaign.id,
        state: LeadState.COLD,
        status: 'ACTIVE',
        tags: { none: { name: 'black' } }, // Exclude blacklisted
      },
      include: { currentStage: true, tags: true },
    });

    for (const lead of leads) {
      await this.processLeadSequence(lead, campaign);
    }
  }

  /**
   * Process individual lead through sequence
   */
  private static async processLeadSequence(lead: any, campaign: any) {
    const now = new Date();
    const lastInteraction = new Date(lead.lastInteraction);
    const hoursSinceInteraction = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);

    // If no current stage, start with M1
    if (!lead.currentStage) {
      const firstStage = campaign.stages.find((s: any) => s.order === 1);
      if (firstStage) {
        await this.sendStageMessage(lead, firstStage);
      }
      return;
    }

    // Check if it's time for next stage
    const currentStage = lead.currentStage;
    const nextStage = campaign.stages.find((s: any) => s.order === currentStage.order + 1);

    if (nextStage && hoursSinceInteraction >= currentStage.waitHours) {
      // Check if lead has responded
      const hasResponded = await this.hasLeadRespondedSinceStage(lead.id, currentStage.name);

      if (!hasResponded) {
        await this.sendStageMessage(lead, nextStage);
      }
    }
  }

  /**
   * Send message for a specific campaign stage
   */
  static async sendStageMessage(lead: any, stage: any) {
    const renderedMessage = await TemplateService.getRenderedMessage(lead.id, stage.id);

    if (!renderedMessage) {
      logger.warn({ leadId: lead.id, stageId: stage.id }, 'No template found for stage');
      return;
    }

    // --- POINT 1: THE 2-MESSAGE LIMIT ---
    // If the user hasn't replied to the last 2 system messages, we stop sending.
    if ((lead.unansweredCount || 0) >= 2) {
      logger.info(
        { leadId: lead.id, count: lead.unansweredCount },
        'Sequence paused: Max unanswered messages reached (2)'
      );
      return;
    }

    // Get template for button support
    const template = await TemplateService.getTemplate(stage.id);
    const buttons = template?.hasButtons && template.buttons ? JSON.parse(template.buttons) : null;

    // --- SMART COMPLIANCE ROUTING ---
    const canSendFreeform = await WhatsAppService.canSendFreeform(lead.id);
    let res;

    if (canSendFreeform) {
      // Within 24-hour window: send freeform text or interactive buttons
      if (buttons && buttons.length > 0) {
        res = await WhatsAppService.sendInteractiveButtons(
          lead.phoneNumber,
          renderedMessage,
          buttons
        );
      } else {
        res = await WhatsAppService.sendText(lead.phoneNumber, renderedMessage);
      }
    } else {
      // Outside 24-hour window: MUST use Meta-approved template
      const { TemplateSyncService } = await import('./template-sync.service.js');
      const waTemplate = await TemplateSyncService.getWhatsAppTemplateForMessage(stage.id);

      if (waTemplate && waTemplate.status === 'APPROVED') {
        const variableMapping = waTemplate.variableMapping
          ? JSON.parse(waTemplate.variableMapping)
          : {};

        // Build context for rendering (name, business name, etc.)
        const context = {
          name: lead.name || 'amigo',
          business: 'whatsnaŭ', // Fallback or fetch from lead context
          ...(lead.metadata ? JSON.parse(lead.metadata) : {}),
        };

        const components = TemplateSyncService.renderTemplateForMeta(
          renderedMessage,
          context,
          variableMapping
        );

        res = await WhatsAppService.sendTemplateWithVariables(
          lead.phoneNumber,
          waTemplate.name,
          components,
          waTemplate.language
        );
      } else {
        logger.error(
          { leadId: lead.id, stage: stage.name },
          'Compliance Error: No approved WhatsApp Template linked for business-initiated message'
        );
        // Fallback: Try to send as text but expect Meta rejection (error code 131030)
        res = await WhatsAppService.sendText(lead.phoneNumber, renderedMessage);
      }
    }

    const whatsappId = res?.messages?.[0]?.id;

    // Update lead stage AND increment unanswered count
    await (db as any).lead.update({
      where: { id: lead.id },
      data: {
        currentStageId: stage.id,
        unansweredCount: { increment: 1 },
        lastInteraction: new Date(),
      },
    });

    // Track message
    if (whatsappId) {
      await db.message.create({
        data: {
          leadId: lead.id,
          direction: 'OUTBOUND',
          content: renderedMessage,
          whatsappId,
          campaignStage: stage.name,
          status: 'sent',
        },
      });
    }

    logger.info({ leadId: lead.id, stage: stage.name }, 'Sequence message sent');
  }

  /**
   * Check if lead has responded since a specific stage
   */
  private static async hasLeadRespondedSinceStage(
    leadId: string,
    stageName: string
  ): Promise<boolean> {
    // Find the last outbound message for this stage
    const lastOutbound = await db.message.findFirst({
      where: {
        leadId,
        direction: 'OUTBOUND',
        campaignStage: stageName,
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!lastOutbound) return false;

    // Check if there are any inbound messages after it
    const inboundCount = await db.message.count({
      where: {
        leadId,
        direction: 'INBOUND',
        timestamp: { gt: lastOutbound.timestamp },
      },
    });

    return inboundCount > 0;
  }

  /**
   * Process Nurturing Onboarding Sequence
   */
  private static async processNurturingOnboarding() {
    const nurturingCampaign = await db.campaign.findFirst({
      where: { name: 'Nurturing Onboarding', isActive: true },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    if (!nurturingCampaign) return;

    // Get leads in NURTURING state who haven't completed onboarding
    const nurturingLeads = await db.lead.findMany({
      where: {
        state: LeadState.NURTURING,
        nurturingOnboardingComplete: false,
        status: 'ACTIVE',
      },
      include: { currentStage: true, tags: true },
    });

    for (const lead of nurturingLeads) {
      await this.processNurturingOnboardingForLead(lead, nurturingCampaign);
    }
  }

  /**
   * Process nurturing onboarding for individual lead
   */
  private static async processNurturingOnboardingForLead(lead: any, campaign: any) {
    const now = new Date();
    const optInTime = new Date(lead.nurturingOptInAt);
    const hoursSinceOptIn = (now.getTime() - optInTime.getTime()) / (1000 * 60 * 60);

    // Determine which stage to send based on time
    let targetStage = null;

    if (hoursSinceOptIn < 1) {
      targetStage = campaign.stages.find((s: any) => s.order === 1);
    } else if (hoursSinceOptIn >= 8 && hoursSinceOptIn < 16) {
      targetStage = campaign.stages.find((s: any) => s.order === 2);
    } else if (hoursSinceOptIn >= 23) {
      targetStage = campaign.stages.find((s: any) => s.order === 3);
    }

    if (targetStage) {
      // Check if this stage was already sent
      const alreadySent = await db.message.findFirst({
        where: {
          leadId: lead.id,
          campaignStage: targetStage.name,
          direction: 'OUTBOUND',
        },
      });

      if (!alreadySent) {
        await this.sendStageMessage(lead, targetStage);

        // If this was the last stage, mark onboarding complete
        if (targetStage.order === 3) {
          await LeadService.completeNurturingOnboarding(lead.id);
        }
      }
    }
  }

  /**
   * REASSURANCE: Check for leads waiting for human handover.
   * Trigger if no outbound message in last 30 minutes.
   */
  private static async processHandoverFollowUps() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const leadsWaiting = await db.lead.findMany({
      where: {
        status: 'HANDOVER',
        lastInteraction: { lt: thirtyMinutesAgo },
        tags: { none: { name: 'handover_reassurance_sent' } },
      },
    });

    for (const lead of leadsWaiting) {
      logger.info({ leadId: lead.id }, 'Sending handover reassurance message');
      const message =
        'Hola, sigo aquí. Samuel está tardando un poco más de lo previsto en liberarse, pero no me he olvidado de ti. ¿Hay algo más en lo que pueda ayudarte mientras esperas?';

      const res = await WhatsAppService.sendText(lead.phoneNumber, message);
      const whatsappId = res?.messages?.[0]?.id;

      await db.lead.update({
        where: { id: lead.id },
        data: {
          lastInteraction: new Date(),
        },
      });

      // Create tag if it doesn't exist
      let tag = await db.tag.findUnique({
        where: {
          tenantId_name: {
            tenantId: lead.tenantId,
            name: 'handover_reassurance_sent',
          },
        },
      });
      if (!tag) {
        tag = await db.tag.create({
          data: {
            name: 'handover_reassurance_sent',
            category: 'SYSTEM',
            description: 'Handover reassurance message sent',
            tenantId: lead.tenantId,
          },
        });
      }

      await db.lead.update({
        where: { id: lead.id },
        data: {
          tags: { connect: { id: tag.id } },
        },
      });

      if (whatsappId) {
        await db.message.create({
          data: {
            leadId: lead.id,
            direction: 'OUTBOUND',
            content: message,
            whatsappId,
            aiGenerated: true,
            campaignStage: 'HANDOVER_REASSURANCE',
            status: 'sent',
          },
        });
      }
    }
  }
}
