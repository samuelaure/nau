import { db } from '../db.js';
import { logger } from '../logger.js';
import { WhatsAppService } from '../../services/whatsapp.service.js';
import { GlobalConfigService } from '../../services/config.global.service.js';

export interface MessageRoute {
  type: 'FREEFORM' | 'TEMPLATE';
  templateName?: string;
  templateLanguage?: string;
}

/**
 * ComplianceGateway - Ensures all messages adhere to WhatsApp & Business rules
 */
export class ComplianceGateway {
  /**
   * Check if we are allowed to send a message to a lead (Anti-Spam)
   */
  static async canSendMessage(leadId: string): Promise<boolean> {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: { unansweredCount: true, tenantId: true },
    });

    if (!lead) return false;

    const config = await GlobalConfigService.getConfig(lead.tenantId);
    const maxUnanswered = config.maxUnansweredMessages;

    if (lead.unansweredCount >= maxUnanswered) {
      logger.warn(
        { leadId, unansweredCount: lead.unansweredCount, maxUnanswered },
        'Compliance: Max unanswered messages reached. Blocking outbound message.'
      );
      return false;
    }

    return true;
  }

  /**
   * Determine whether to send a freeform message or a template
   * based on the 24-hour window compliance.
   */
  static async resolveMessageRoute(leadId: string): Promise<MessageRoute> {
    const isWithinWindow = await WhatsAppService.canSendFreeform(leadId);

    if (isWithinWindow) {
      return { type: 'FREEFORM' };
    }

    return { type: 'TEMPLATE' };
  }

  /**
   * Check if a message content contains forbidden keywords (optional)
   */
  static async isContentAllowed(content: string): Promise<boolean> {
    // Implement keyword filtering if needed
    return true;
  }
}
