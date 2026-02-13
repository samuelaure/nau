import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { db } from '../core/db.js';
import { sanitizeForTelegram } from './sanitization.util.js';
import { TelegramService } from './telegram.service.js';

export class NotificationService {
  private static alertCooldowns = new Map<string, number>();

  static async notifyHandover(lead: any, reasoning?: string) {
    const sanitizedLead = sanitizeForTelegram(lead);
    const dashboardUrl = config.DASHBOARD_URL;
    const leadLink = `${dashboardUrl}?leadId=${lead.id}`;
    const text =
      `🚨 <b>Intelligent Handover Triggered</b>\n\n` +
      `👤 <b>Lead:</b> ${sanitizedLead.name || 'Unknown'} (${sanitizedLead.phoneNumber})\n` +
      `📝 <b>Reasoning:</b> ${reasoning || 'Lead requested human intervention.'}\n\n` +
      `🔗 <a href="${leadLink}">Open Chat</a>`;

    if (lead.tenantId) {
      await TelegramService.sendTenantNotification(lead.tenantId, text);
    } else {
      logger.warn({ leadId: lead.id }, 'Lead missing tenantId, cannot send handover notification');
    }
  }

  static async notifyHighIntent(lead: any, message: string) {
    const sanitizedLead = sanitizeForTelegram(lead);
    const sanitizedMessage = '[REDACTED]'; // Never send message content to Telegram
    const dashboardUrl = config.DASHBOARD_URL;
    const leadLink = `${dashboardUrl}?leadId=${lead.id}`;
    const text =
      `🔥 <b>High Intent Detected</b>\n\n` +
      `👤 <b>Lead:</b> ${sanitizedLead.name || 'Unknown'} (${sanitizedLead.phoneNumber})\n` +
      `💬 <b>Message:</b> "${sanitizedMessage}"\n\n` +
      `🔗 <a href="${leadLink}">Open Chat and Intervene</a>`;

    if (lead.tenantId) {
      await TelegramService.sendTenantNotification(lead.tenantId, text);
    }
  }

  // Generic system error notification with cooldown (System Admin)
  static async notifySystemError(severity: 'WARN' | 'CRITICAL', context: any): Promise<void> {
    // Check cooldown to avoid spam
    const key = `${severity}-${context.category}`;
    const lastAlert = this.alertCooldowns.get(key);
    const cooldownMs = 15 * 60 * 1000; // 15 minutes

    if (lastAlert && Date.now() - lastAlert < cooldownMs) {
      logger.debug({ key }, 'Alert skipped due to cooldown');
      return;
    }

    this.alertCooldowns.set(key, Date.now());

    // Sanitize context before storing and sending
    const sanitizedContext = sanitizeForTelegram(context);

    // Log to database
    try {
      await db.systemAlert.create({
        data: {
          severity,
          category: context.category,
          message: context.error?.message || context.message,
          context: sanitizedContext, // Store sanitized version
          tenantId: context.tenantId,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to create SystemAlert');
    }

    // Send Telegram alert with sanitized data to SYSTEM ADMIN
    const icon = severity === 'CRITICAL' ? '🚨' : '⚠️';
    const message =
      `${icon} <b>${severity}</b>: ${context.category}\n\n` + // Use \n not \\n for template string
      `${context.error?.message || context.message}\n\n` +
      `Tenant: ${sanitizedContext.tenantId || 'N/A'}\n` +
      `Time: ${new Date().toISOString()}`;

    await TelegramService.sendSystemNotification(message);

    logger.error({ ...sanitizedContext, severity }, 'System error notification sent');
  }

  // Fatal error notification (critical failures requiring immediate attention)
  static async notifyFatalError(category: string, error: Error): Promise<void> {
    return this.notifySystemError('CRITICAL', {
      category,
      error,
      message: 'Fatal error occurred',
    });
  }

  // Infrastructure failure notification (DB/Redis/etc)
  static async notifyInfrastructureFailure(service: string, error: any): Promise<void> {
    return this.notifySystemError('CRITICAL', {
      category: `INFRASTRUCTURE_${service.toUpperCase()}`,
      error,
      message: `${service} infrastructure failure`,
    });
  }

  // AI service degradation notification
  static async notifyAIDegradation(leadId: string): Promise<void> {
    // Try to get tenantId if possible? 
    // Usually degradation is system wide or tenant wide. 
    // Here we treat it as system alert for Ops to investigate.
    return this.notifySystemError('WARN', {
      category: 'AI_DEGRADATION',
      message: 'AI service unavailable, triggering human handover',
      leadId,
    });
  }

  // Message send failure notification (after retry exhaustion)
  static async notifyMessageFailure(leadId: string, error: Error): Promise<void> {
    return this.notifySystemError('WARN', {
      category: 'MESSAGE_SEND_FAILED',
      error,
      leadId,
    });
  }
}
