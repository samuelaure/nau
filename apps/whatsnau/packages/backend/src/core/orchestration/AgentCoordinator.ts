import { db } from '../db.js';
import { logger } from '../logger.js';
import { AIService } from '../../services/ai.service.js';
import { NotificationService } from '../../services/notification.service.js';
import { EventsService } from '../../services/events.service.js';
import { maintenanceQueue } from '../../infrastructure/queues/maintenance.queue.js';
import { outboundQueue } from '../../infrastructure/queues/outbound.queue.js';
import { getCorrelationId } from '../observability/CorrelationId.js';
import { Lead, CampaignStage } from '@prisma/client';

type AgentLead = Lead & { currentStage?: CampaignStage | null };

/**
 * AgentCoordinator - Orchestrates AI logic, manual handover, and asynchronous sending
 */
export class AgentCoordinator {
  /**
   * Main entry point for deciding how to process an inbound message based on AI intent
   */
  static async handleInboundAI(
    lead: AgentLead,
    content: string,
    onPhaseRequest: (phase: string) => Promise<void>
  ) {
    if (lead.status === 'HANDOVER' || !lead.aiEnabled) {
      logger.info(
        { leadId: lead.id },
        'Lead in manual handover or AI disabled, skipping AI processing'
      );
      return;
    }

    // 1. Check for manual-override keywords
    const leadKeywords = await db.takeoverKeyword.findMany({
      where: { tenantId: lead.tenantId, type: 'LEAD' },
    });
    const isManualTrigger = leadKeywords.some((k) =>
      content.toUpperCase().includes(k.word.toUpperCase())
    );

    let aiClassification = null;
    if (!isManualTrigger) {
      aiClassification = await AIService.classifyIntent(content);
    }

    // 2. Decide if human is needed
    if (isManualTrigger || aiClassification?.intent === 'request_human') {
      return this.initiateHandover(lead, aiClassification?.reasoning);
    }

    // 3. Handle high intent notifications
    if (
      aiClassification?.intent === 'buy_interest' ||
      aiClassification?.intent === 'demo_request'
    ) {
      await NotificationService.notifyHighIntent(lead, content);
      // LeadService call would go here if we were in Orchestrator
    }

    // 4. Delegate to phase handling
    await onPhaseRequest(lead.state);
  }

  /**
   * Transition lead to manual handover mode
   */
  static async initiateHandover(lead: AgentLead, reasoning?: string) {
    logger.info(
      { leadId: lead.id, reasoning, correlationId: getCorrelationId() },
      'Initiating manual handover'
    );

    await db.lead.update({
      where: { id: lead.id },
      data: { status: 'HANDOVER' },
    });

    EventsService.emit('handover', { leadId: lead.id, reasoning });
    await NotificationService.notifyHandover(lead, reasoning);

    // Schedule Recovery
    const config = await db.globalConfig.findUnique({
      where: { tenantId: lead.tenantId },
    });
    const delayMins = config?.recoveryTimeoutMinutes || 240;

    await maintenanceQueue.add(
      'lead-recovery',
      { leadId: lead.id, tenantId: lead.tenantId },
      { delay: delayMins * 60 * 1000, jobId: `recovery-${lead.id}` }
    );

    // Send bridge message
    const availStatus = config?.availabilityStatus;
    const responseMsg = `Perfecto, le avisaré a Samuel que deseas hablar con él directamente.${
      availStatus
        ? ` Samuel está actualmente ${availStatus}, pero ya sabe que quieres hablar con él.`
        : ' Le he notificado a Samuel, vendrá lo antes que pueda.'
    } Mientras esperamos, aquí estaré si necesitas algo.`;

    await this.sendAsync(
      lead,
      'text',
      { body: responseMsg },
      responseMsg,
      'HANDOVER_ENTERTAIN',
      true
    );
  }

  /**
   * Trigger appropriate AI agent based on role
   */
  static async triggerAgent(
    lead: AgentLead,
    role: 'CLOSER' | 'RECEPTIONIST' | 'NURTURING',
    userMessage?: string
  ) {
    const correlationId = getCorrelationId();

    // 1. Get conversation history
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

    // 2. Call AI Service with Fallback support
    const response = await AIService.getChatResponseWithFallback(
      lead.id,
      lead.campaignId,
      role,
      aiMessages
    );

    if (response) {
      await this.sendAsync(
        lead,
        'text',
        { body: response },
        response,
        lead.currentStage?.name || lead.state,
        true
      );
    } else {
      logger.warn(
        { leadId: lead.id, correlationId },
        'AI failed to produce response, triggering human fallback'
      );
      await this.initiateHandover(lead, 'AI Service Unavailable (Circuit Breaker or Error)');
    }
  }

  /**
   * Queue outbound message
   */
  static async sendAsync(
    lead: any,
    type: 'text' | 'template' | 'interactive',
    payload: any,
    content: string,
    stage?: string,
    aiGenerated = false
  ) {
    const stageName = stage || lead.currentStage?.name || lead.state;
    const correlationId = getCorrelationId();

    // 1. Create Pending Record
    const message = await db.message.create({
      data: {
        leadId: lead.id,
        direction: 'OUTBOUND',
        content,
        whatsappId: `pending-${Date.now()}`,
        aiGenerated,
        campaignStage: stageName,
        status: 'pending',
      },
    });

    // 2. Queue Job
    await outboundQueue.add(
      'outbound-message',
      {
        campaignId: lead.campaignId,
        phoneNumber: lead.phoneNumber,
        type,
        payload,
        messageId: message.id,
        leadId: lead.id,
        correlationId,
      },
      { removeOnComplete: true }
    );

    return message;
  }
}
