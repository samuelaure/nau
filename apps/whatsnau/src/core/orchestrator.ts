import { db } from './db.js';
import { logger } from './logger.js';
import { LeadService, LeadState } from '../services/lead.service.js';
import { AIService } from '../services/ai.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { EventsService } from '../services/events.service.js';
import { NotificationService } from '../services/notification.service.js';
import { MessageBufferService } from '../services/buffer.service.js';
import { TemplateService } from '../services/template.service.js';

export class Orchestrator {
  /**
   * Main entry point for all incoming WhatsApp messages.
   * Focuses on persistence and debouncing.
   */
  static async handleIncoming(
    from: string,
    text?: string,
    buttonId?: string,
    direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND',
    whatsappId?: string
  ) {
    const content = text || buttonId || '';
    logger.info({ from, content, direction, whatsappId }, 'Orchestrating interaction');

    // 1. Find or initialize Lead
    let lead = await db.lead.findUnique({
      where: { phoneNumber: from },
      include: {
        campaign: { include: { stages: { orderBy: { order: 'asc' } } } },
        tags: true,
        currentStage: true,
      },
    });

    if (!lead) {
      if (direction === 'OUTBOUND') return;
      const campaign = await db.campaign.findFirst({ where: { isActive: true } });
      if (!campaign) return;
      const initialLead = await LeadService.initiateLead(from, campaign.id);
      lead = await db.lead.findUnique({
        where: { id: initialLead.id },
        include: {
          campaign: { include: { stages: { orderBy: { order: 'asc' } } } },
          tags: true,
          currentStage: true,
        },
      });
    }

    if (!lead) return;

    // 2. Track message in DB
    await db.message.upsert({
      where: { whatsappId: whatsappId || 'unknown' },
      create: {
        leadId: lead.id,
        direction,
        content,
        whatsappId,
        type: buttonId ? 'BUTTON_RESPONSE' : 'TEXT',
        campaignStage: lead.currentStage?.name || lead.state,
        isProcessed: direction === 'OUTBOUND',
      },
      update: {
        content,
      },
    });

    // 3. Update Activity Timestamp for Debouncing & Reset Unanswered Counter
    if (direction === 'INBOUND') {
      await (db as any).lead.update({
        where: { id: lead.id },
        data: {
          lastInboundAt: new Date(),
          unansweredCount: 0, // Reset counter: user responded!
        },
      });
    }

    // Emit real-time message event
    EventsService.emit('message', {
      leadId: lead.id,
      content,
      direction,
      whatsappId,
      timestamp: new Date(),
    });

    // 4. Source-Aware Processing
    if (direction === 'OUTBOUND') {
      await this.handleOutboundTakeover(lead, content);
    } else {
      await MessageBufferService.scheduleProcessing(from);
    }
  }

  /**
   * Process a burst of messages from a lead.
   */
  static async processBurst(from: string) {
    const lead = await db.lead.findUnique({
      where: { phoneNumber: from },
      include: {
        campaign: { include: { stages: { orderBy: { order: 'asc' } } } },
        tags: true,
        currentStage: true,
      },
    });

    if (!lead || !lead.aiEnabled || lead.status === 'HANDOVER') return;

    const pendingMessages = await db.message.findMany({
      where: { leadId: lead.id, direction: 'INBOUND', isProcessed: false },
      orderBy: { timestamp: 'asc' },
    });

    if (pendingMessages.length === 0) return;

    const fullContent = pendingMessages.map((m) => m.content).join('\n');
    const lastButtonId = [...pendingMessages]
      .reverse()
      .find((m) => m.type === 'BUTTON_RESPONSE')?.content;

    logger.info({ leadId: lead.id, burstSize: pendingMessages.length }, 'Processing message burst');

    await db.message.updateMany({
      where: { id: { in: pendingMessages.map((m) => m.id) } },
      data: { isProcessed: true },
    });

    await this.handleInboundProcessing(lead, fullContent, lastButtonId);
  }

  /**
   * Update delivery status of a message.
   */
  static async handleStatusUpdate(whatsappId: string, status: string) {
    logger.info({ whatsappId, status }, 'Updating message status');
    try {
      await (db as any).message.updateMany({
        where: { whatsappId },
        data: { status },
      });

      EventsService.emit('status', { whatsappId, status });

      if (status === 'read') {
        await db.message.updateMany({
          where: { whatsappId },
          data: { wasRead: true },
        });
      }
    } catch (error) {
      logger.error({ err: error, whatsappId }, 'Failed to update message status');
    }
  }

  /**
   * SILENT TAKEOVER: Triggered by business/owner messages.
   */
  private static async handleOutboundTakeover(lead: any, content: string) {
    const internalKeywords = await db.takeoverKeyword.findMany({ where: { type: 'INTERNAL' } });
    const triggers = internalKeywords.map((k) => k.word.toUpperCase());

    if (triggers.includes(content.toUpperCase().trim())) {
      await db.lead.update({
        where: { id: lead.id },
        data: { status: 'HANDOVER' },
      });
      logger.info({ leadId: lead.id }, 'Silent takeover triggered by owner message');
    }
  }

  /**
   * INTELLIGENT PROCESSING: Handle lead messages.
   */
  private static async handleInboundProcessing(lead: any, content: string, buttonId?: string) {
    if (lead.status === 'HANDOVER' || !lead.aiEnabled) {
      logger.info(
        { leadId: lead.id, aiEnabled: lead.aiEnabled },
        'Lead in manual handover or AI disabled, skipping'
      );
      return;
    }

    const leadKeywords = await db.takeoverKeyword.findMany({ where: { type: 'LEAD' } });
    const leadTriggers = leadKeywords.map((k) => k.word.toUpperCase());

    let requiresHuman = leadTriggers.includes(content.toUpperCase().trim());
    let aiClassification = null;

    if (!requiresHuman) {
      aiClassification = await AIService.classifyIntent(content);
      requiresHuman = aiClassification?.intent === 'request_human';
    }

    if (requiresHuman) {
      return this.handleHumanRequest(lead, aiClassification?.reasoning);
    }

    if (
      aiClassification?.intent === 'buy_interest' ||
      aiClassification?.intent === 'demo_request'
    ) {
      await NotificationService.notifyHighIntent(lead, content);
      await LeadService.addTag(lead.id, 'high_intent');
    }

    switch (lead.state as LeadState) {
      case LeadState.COLD:
        await this.handleColdPhase(lead, content, buttonId);
        break;
      case LeadState.INTERESTED:
        await this.handleInterestedPhase(lead, content, buttonId);
        break;
      case LeadState.DEMO:
        await this.handleDemoPhase(lead, content, buttonId);
        break;
      case LeadState.NURTURING:
        await this.handleNurturingPhase(lead, content, buttonId);
        break;
    }
  }

  private static async handleHumanRequest(lead: any, reasoning?: string) {
    logger.info({ leadId: lead.id, reasoning }, 'Intelligent handover triggered by lead');

    await db.lead.update({
      where: { id: lead.id },
      data: { status: 'HANDOVER' },
    });
    EventsService.emit('handover', { leadId: lead.id, reasoning });
    await NotificationService.notifyHandover(lead, reasoning);

    const config = await db.globalConfig.findUnique({ where: { id: 'singleton' } });
    const statusMsg = config?.availabilityStatus
      ? ` Samuel está actualmente ${config.availabilityStatus}, pero ya sabe que quieres hablar con él.`
      : ` Le he notificado a Samuel, vendrá lo antes que pueda.`;

    const responseMsg = `Perfecto, le avisaré a Samuel que deseas hablar con él directamente.${statusMsg} Mientras esperamos, aquí estaré si necesitas algo.`;

    const res = await WhatsAppService.sendText(lead.phoneNumber, responseMsg);
    await this.trackOutboundMessage(
      lead,
      responseMsg,
      res?.messages?.[0]?.id,
      'HANDOVER_ENTERTAIN',
      true
    );
  }

  private static async trackOutboundMessage(
    lead: any,
    content: string,
    whatsappId: string,
    stage?: string,
    aiGenerated = false
  ) {
    if (!whatsappId) return;
    await (db as any).message.create({
      data: {
        leadId: lead.id,
        direction: 'OUTBOUND',
        content,
        whatsappId,
        aiGenerated,
        campaignStage: stage || lead.currentStage?.name || lead.state,
        status: 'sent',
      },
    });
  }

  /**
   * Handle COLD phase (M1, M2, M3 sequence responses)
   */
  private static async handleColdPhase(lead: any, content: string, buttonId?: string) {
    // Check for YES response
    if (
      buttonId === 'yes_interested' ||
      content.toLowerCase().includes('si') ||
      content.toLowerCase().includes('interesa')
    ) {
      await LeadService.transition(lead.id, LeadState.INTERESTED);
      await LeadService.addTag(lead.id, 'interested');
      await this.triggerAgent(lead, 'CLOSER');
      return;
    }

    // Check for NO response
    if (buttonId === 'no_thanks' || content.toLowerCase().includes('no')) {
      // Send M3 immediately (skip M2)
      await this.sendWeeklyTipsInvite(lead);
      return;
    }

    // Check for nurturing opt-in (response to M3)
    if (
      buttonId === 'yes_nurturing' ||
      (content.toLowerCase().includes('si') && content.toLowerCase().includes('envía'))
    ) {
      await LeadService.optIntoNurturing(lead.id);
      await this.triggerAgent(lead, 'NURTURING');
      return;
    }

    if (buttonId === 'no_nurturing') {
      const isInterested = await LeadService.hasTag(lead.id, 'interested');
      if (!isInterested) {
        await LeadService.addTag(lead.id, 'colder');
      }
      return;
    }

    // Ambiguous response - let Closer handle it
    await LeadService.transition(lead.id, LeadState.INTERESTED);
    await this.triggerAgent(lead, 'CLOSER', content);
  }

  /**
   * Send M3 (Weekly Tips Invitation)
   */
  private static async sendWeeklyTipsInvite(lead: any) {
    const campaign = await db.campaign.findUnique({
      where: { id: lead.campaignId },
      include: { stages: true },
    });

    const m3Stage = campaign?.stages.find((s) => s.name === 'M3-WeeklyTipsInvite');
    if (!m3Stage) return;

    // --- POINT 1: THE 2-MESSAGE LIMIT ---
    if ((lead.unansweredCount || 0) >= 2) {
      logger.info({ leadId: lead.id }, 'Weekly tips invite skipped: Max unanswered (2)');
      return;
    }

    const message = await TemplateService.getRenderedMessage(lead.id, m3Stage.id);
    if (!message) return;

    const template = await TemplateService.getTemplate(m3Stage.id);
    const buttons = template?.hasButtons && template.buttons ? JSON.parse(template.buttons) : null;

    // --- SMART COMPLIANCE ROUTING ---
    const canSendFreeform = await WhatsAppService.canSendFreeform(lead.id);
    let res;

    if (canSendFreeform) {
      if (buttons && buttons.length > 0) {
        res = await WhatsAppService.sendInteractiveButtons(lead.phoneNumber, message, buttons);
      } else {
        res = await WhatsAppService.sendText(lead.phoneNumber, message);
      }
    } else {
      const { TemplateSyncService } = await import('../services/template-sync.service.js');
      const waTemplate = await TemplateSyncService.getWhatsAppTemplateForMessage(m3Stage.id);

      if (waTemplate && waTemplate.status === 'APPROVED') {
        const variableMapping = waTemplate.variableMapping
          ? JSON.parse(waTemplate.variableMapping)
          : {};
        const context = {
          name: lead.name || 'amigo',
          business: 'whatsnaŭ',
          ...(lead.metadata ? JSON.parse(lead.metadata) : {}),
        };

        const components = TemplateSyncService.renderTemplateForMeta(
          message,
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
          { leadId: lead.id, stage: m3Stage.name },
          'Compliance Error: No approved WhatsApp Template linked for M3 business-initiated message'
        );
        res = await WhatsAppService.sendText(lead.phoneNumber, message);
      }
    }

    await (db as any).lead.update({
      where: { id: lead.id },
      data: {
        currentStageId: m3Stage.id,
        unansweredCount: { increment: 1 },
        lastInteraction: new Date(),
      },
    });

    if (res?.messages?.[0]?.id) {
      await db.message.create({
        data: {
          leadId: lead.id,
          direction: 'OUTBOUND',
          content: message,
          whatsappId: res.messages[0].id,
          campaignStage: m3Stage.name,
          status: 'sent',
        },
      });
    }
  }

  /**
   * Handle INTERESTED phase (pre-sale conversations)
   */
  private static async handleInterestedPhase(lead: any, content: string, buttonId?: string) {
    if (buttonId === 'ver_demo' || content.toLowerCase().includes('demo'))
      return this.startDemo(lead);
    await this.triggerAgent(lead, 'CLOSER', content);
  }

  /**
   * Handle DEMO phase
   */
  private static async handleDemoPhase(lead: any, content: string, buttonId?: string) {
    if (lead.demoExpiresAt && new Date() > new Date(lead.demoExpiresAt)) {
      await LeadService.endDemo(lead.id);
      const msg = 'La demo ha finalizado. Regresamos a nuestra charla. ¿Qué te ha parecido?';
      const res = await WhatsAppService.sendText(lead.phoneNumber, msg);
      await this.trackOutboundMessage(lead, msg, res?.messages?.[0]?.id);
      return;
    }
    await this.triggerAgent(lead, 'RECEPTIONIST', content);
  }

  /**
   * Start demo session
   */
  private static async startDemo(lead: any) {
    await LeadService.startDemo(lead.id, 10);
    const msg =
      '¡Genial! A partir de ahora hablas con mi **Recepcionista IA**. Prueba a preguntarme sobre el negocio.';
    const res = await WhatsAppService.sendText(lead.phoneNumber, msg);
    await this.trackOutboundMessage(
      { ...lead, state: LeadState.DEMO },
      msg,
      res?.messages?.[0]?.id
    );
    await this.triggerAgent(
      { ...lead, state: LeadState.DEMO },
      'RECEPTIONIST',
      'Hola, soy tu nueva recepcionista.'
    );
  }

  /**
   * Enhanced triggerAgent with new context injection
   */
  private static async triggerAgent(
    lead: any,
    role: 'CLOSER' | 'RECEPTIONIST' | 'NURTURING',
    userMessage?: string
  ) {
    // Get conversation history
    const history = await db.message.findMany({
      where: { leadId: lead.id },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    const aiMessages = history.reverse().map((m) => ({
      role: (m.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));

    if (
      userMessage &&
      (!aiMessages.length || aiMessages[aiMessages.length - 1].content !== userMessage)
    ) {
      aiMessages.push({ role: 'user', content: userMessage });
    }

    // Use enhanced AI service with context
    const response = await AIService.getChatResponseWithContext(
      lead.id,
      lead.campaignId,
      role,
      aiMessages
    );

    if (response) {
      const res = await WhatsAppService.sendText(lead.phoneNumber, response);
      await this.trackOutboundMessage(
        lead,
        response,
        res?.messages?.[0]?.id,
        lead.currentStage?.name || lead.state,
        true
      );
    }
  }

  /**
   * Handle nurturing phase
   */
  private static async handleNurturingPhase(lead: any, content: string, buttonId?: string) {
    // Update last broadcast interaction
    await db.lead.update({
      where: { id: lead.id },
      data: { lastBroadcastInteraction: new Date() },
    });

    // Trigger Nurturing Buddy agent
    await this.triggerAgent(lead, 'NURTURING', content);
  }
}
