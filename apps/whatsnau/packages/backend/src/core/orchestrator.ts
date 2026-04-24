import { db } from './db.js';
import { logger } from './logger.js';
import { MessageBufferService } from '../services/buffer.service.js';
import { EventsService } from '../services/events.service.js';
import { MessageRouter } from './orchestration/MessageRouter.js';
import { AgentCoordinator } from './orchestration/AgentCoordinator.js';
import { StateTransitionEngine } from './orchestration/StateTransitionEngine.js';
import { withErrorBoundary } from './resilience/ErrorBoundary.js';

/**
 * Orchestrator - Main entry point that coordinates specialized services
 */
export class Orchestrator {
  /**
   * Main entry point for all incoming WhatsApp messages
   */
  static async handleIncoming(
    from: string,
    text?: string,
    buttonId?: string,
    direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND',
    whatsappId?: string,
    phoneNumberId?: string
  ) {
    return withErrorBoundary(
      async () => {
        const content = text || buttonId || '';
        logger.info({ from, direction, whatsappId }, 'Orchestrating interaction');

        // 1. Resolve Tenant
        const tenantId = await MessageRouter.resolveTenantId(phoneNumberId);

        // 2. Find/Init Lead
        const lead = await MessageRouter.findOrInitializeLead(from, tenantId);
        if (!lead) return;

        // 3. Persist Message
        await MessageRouter.persistMessage({
          leadId: lead.id,
          direction,
          content,
          whatsappId,
          type: buttonId ? 'BUTTON_RESPONSE' : 'TEXT',
          stageName: lead.currentStage?.name || lead.state,
        });

        // 4. Update Activity & Events
        if (direction === 'INBOUND') {
          await db.lead.update({
            where: { id: lead.id },
            data: { lastInboundAt: new Date(), unansweredCount: 0 },
          });
        }

        EventsService.emit('message', {
          leadId: lead.id,
          content,
          direction,
          whatsappId,
          timestamp: new Date(),
        });

        // 5. Route Processing
        if (direction === 'OUTBOUND') {
          await MessageRouter.handleOutboundTakeover(lead, whatsappId, content);
        } else {
          if (lead.tenantId) {
            await MessageBufferService.scheduleProcessing(lead.tenantId, from);
          }
        }
      },
      {
        category: 'ORCHESTRATOR_INCOMING',
        severity: 'CRITICAL',
        metadata: { from, direction, whatsappId },
      }
    );
  }

  /**
   * Process a burst of messages from a lead
   */
  static async processBurst(tenantId: string, from: string) {
    return withErrorBoundary(
      async () => {
        const lead = await MessageRouter.findOrInitializeLead(from, tenantId);
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

        logger.info(
          { leadId: lead.id, burstSize: pendingMessages.length },
          'Processing message burst'
        );

        await db.message.updateMany({
          where: { id: { in: pendingMessages.map((m) => m.id) } },
          data: { isProcessed: true },
        });

        // Delegate to AgentCoordinator & StateTransitionEngine
        await AgentCoordinator.handleInboundAI(lead, fullContent, (phase) =>
          StateTransitionEngine.handlePhase(lead, fullContent, lastButtonId)
        );
      },
      {
        category: 'ORCHESTRATOR_BURST',
        severity: 'CRITICAL',
        metadata: { tenantId, from },
        tenantId,
      }
    );
  }

  /**
   * Deliver status update
   */
  static async handleStatusUpdate(whatsappId: string, status: string) {
    return MessageRouter.handleStatusUpdate(whatsappId, status);
  }

  /**
   * Queue message (exposed for internal services)
   */
  static async sendAsync(
    lead: any,
    type: 'text' | 'template' | 'interactive',
    payload: any,
    content: string,
    stage?: string,
    aiGenerated = false
  ) {
    return AgentCoordinator.sendAsync(lead, type, payload, content, stage, aiGenerated);
  }
}
