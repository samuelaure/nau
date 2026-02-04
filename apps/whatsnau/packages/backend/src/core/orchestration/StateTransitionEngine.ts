import { db } from '../db.js';
import { logger } from '../logger.js';
import { LeadService, LeadState } from '../../services/lead.service.js';
import { TemplateService } from '../../services/template.service.js';
import { GlobalConfigService } from '../../services/config.global.service.js';
import { AgentCoordinator } from './AgentCoordinator.js';
import { ComplianceGateway } from './ComplianceGateway.js';

/**
 * StateTransitionEngine - Handles phase-specific business logic and transitions
 */
export class StateTransitionEngine {
  /**
   * Main entry point for phase handling
   */
  static async handlePhase(lead: any, content: string, buttonId?: string) {
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
        await this.handleNurturingPhase(lead, content);
        break;
    }
  }

  private static async handleColdPhase(lead: any, content: string, buttonId?: string) {
    if (
      buttonId === 'yes_interested' ||
      content.toLowerCase().includes('si') ||
      content.toLowerCase().includes('interesa')
    ) {
      await LeadService.transition(lead.id, LeadState.INTERESTED);
      await LeadService.addTag(lead.id, 'interested');
      await AgentCoordinator.triggerAgent(lead, 'CLOSER');
      return;
    }

    if (buttonId === 'no_thanks' || content.toLowerCase().includes('no')) {
      await this.sendWeeklyTipsInvite(lead);
      return;
    }

    if (
      buttonId === 'yes_nurturing' ||
      (content.toLowerCase().includes('si') && content.toLowerCase().includes('envía'))
    ) {
      await LeadService.optIntoNurturing(lead.id);
      await AgentCoordinator.triggerAgent(lead, 'NURTURING');
      return;
    }

    if (buttonId === 'no_nurturing') {
      if (!(await LeadService.hasTag(lead.id, 'interested'))) {
        await LeadService.addTag(lead.id, 'colder');
      }
      return;
    }

    // Ambiguous response -> Closer handles it
    await LeadService.transition(lead.id, LeadState.INTERESTED);
    await AgentCoordinator.triggerAgent(lead, 'CLOSER', content);
  }

  private static async handleInterestedPhase(lead: any, content: string, buttonId?: string) {
    if (buttonId === 'ver_demo' || content.toLowerCase().includes('demo')) {
      return this.startDemo(lead);
    }
    await AgentCoordinator.triggerAgent(lead, 'CLOSER', content);
  }

  private static async handleDemoPhase(lead: any, content: string, buttonId?: string) {
    if (lead.demoExpiresAt && new Date() > new Date(lead.demoExpiresAt)) {
      await LeadService.endDemo(lead.id);
      const msg = 'La demo ha finalizado. Regresamos a nuestra charla. ¿Qué te ha parecido?';
      await AgentCoordinator.sendAsync(lead, 'text', { body: msg }, msg);
      return;
    }
    await AgentCoordinator.triggerAgent(lead, 'RECEPTIONIST', content);
  }

  private static async handleNurturingPhase(lead: any, content: string) {
    try {
      await db.lead.update({
        where: { id: lead.id },
        data: { lastBroadcastInteraction: new Date() },
      });
      await AgentCoordinator.triggerAgent(lead, 'NURTURING', content);
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Failed to handle nurturing phase');
    }
  }

  private static async startDemo(lead: any) {
    try {
      const config = await GlobalConfigService.getConfig(lead.tenantId);
      const duration = config.defaultDemoDurationMinutes;

      await LeadService.startDemo(lead.id, duration);
      const msg =
        '¡Genial! A partir de ahora hablas con mi **Recepcionista IA**. Prueba a preguntarme sobre el negocio.';

      const demoLead = { ...lead, state: LeadState.DEMO };
      await AgentCoordinator.sendAsync(demoLead, 'text', { body: msg }, msg);
      await AgentCoordinator.triggerAgent(
        demoLead,
        'RECEPTIONIST',
        'Hola, soy tu nueva recepcionista.'
      );
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Failed to start demo');
    }
  }

  private static async sendWeeklyTipsInvite(lead: any) {
    if (!lead.campaignId) {
      logger.warn({ leadId: lead.id }, 'Lead has no campaignId, cannot send weekly tips invite');
      return;
    }

    try {
      const campaign = await db.campaign.findUnique({
        where: { id: lead.campaignId },
        include: { stages: true },
      });

      const m3Stage = campaign?.stages.find((s) => s.name === 'M3-WeeklyTipsInvite');
      if (!m3Stage) return;

      // Check anti-spam
      if (!(await ComplianceGateway.canSendMessage(lead.id))) {
        return;
      }

      const message = await TemplateService.getRenderedMessage(lead.id, m3Stage.id);
      if (!message) return;

      const route = await ComplianceGateway.resolveMessageRoute(lead.id);

      if (route.type === 'FREEFORM') {
        const template = await TemplateService.getTemplate(m3Stage.id);
        const buttons =
          template?.hasButtons && template.buttons ? JSON.parse(template.buttons) : null;

        if (buttons && buttons.length > 0) {
          await AgentCoordinator.sendAsync(
            lead,
            'interactive',
            {
              type: 'button',
              body: { text: message },
              action: {
                buttons: buttons.map((btn: any) => ({
                  type: 'reply',
                  reply: { id: btn.id, title: btn.text.substring(0, 20) },
                })),
              },
            },
            message,
            m3Stage.name
          );
        } else {
          await AgentCoordinator.sendAsync(lead, 'text', { body: message }, message, m3Stage.name);
        }
      } else {
        // Template route
        const { TemplateSyncService } = await import('../../services/template-sync.service.js');
        const waTemplate = await TemplateSyncService.getWhatsAppTemplateForMessage(m3Stage.id);

        if (waTemplate && waTemplate.status === 'APPROVED') {
          const context = {
            name: lead.name || 'amigo',
            business: 'whatsnaŭ',
            ...(lead.metadata ? JSON.parse(lead.metadata) : {}),
          };

          const components = TemplateSyncService.renderTemplateForMeta(
            message,
            context,
            waTemplate.variableMapping ? JSON.parse(waTemplate.variableMapping) : {}
          );

          await AgentCoordinator.sendAsync(
            lead,
            'template',
            {
              name: waTemplate.name,
              language: { code: waTemplate.language || 'es_ES' },
              components,
            },
            message,
            m3Stage.name
          );
        } else {
          logger.error(
            { leadId: lead.id, stage: m3Stage.name },
            'Compliance: No approved template for M3'
          );
          await AgentCoordinator.sendAsync(lead, 'text', { body: message }, message, m3Stage.name);
        }
      }

      await db.lead.update({
        where: { id: lead.id },
        data: {
          currentStageId: m3Stage.id,
          unansweredCount: { increment: 1 },
          lastInteraction: new Date(),
        },
      });
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Failed to send weekly tips invite');
    }
  }
}
