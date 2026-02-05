import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { db } from '../core/db.js';
import { sanitizeForTelegram, formatContextForTelegram } from './sanitization.util.js';

export class NotificationService {
  private static botToken = config.TELEGRAM_BOT_TOKEN;
  private static chatId = config.TELEGRAM_CHAT_ID;
  private static alertCooldowns = new Map<string, number>();

  private static async getSettings() {
    try {
      return await (db as any).telegramConfig.findUnique({ where: { id: 'singleton' } });
    } catch (error) {
      return null;
    }
  }

  static async sendTelegramAlert(message: string) {
    const settings = await this.getSettings();
    const token = settings?.botToken || this.botToken;
    const chat = settings?.chatId || this.chatId;
    const enabled = settings?.isEnabled ?? !!token;

    if (!enabled || !token || !chat) {
      logger.debug('Telegram notifications are disabled or not configured');
      return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        logger.error({ data }, 'Telegram API Error');
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to send Telegram notification');
    }
  }

  static async notifyHandover(lead: any, reasoning?: string) {
    const sanitizedLead = sanitizeForTelegram(lead);
    const dashboardUrl = `http://localhost:5173/`; // Should be configurable
    const leadLink = `${dashboardUrl}?leadId=${lead.id}`;
    const text =
      `🚨 <b>Intelligent Handover Triggered</b>\n\n` +
      `👤 <b>Lead:</b> ${sanitizedLead.name || 'Unknown'} (${sanitizedLead.phoneNumber})\n` +
      `📝 <b>Reasoning:</b> ${reasoning || 'Lead requested human intervention.'}\n\n` +
      `🔗 <a href="${leadLink}">Open Chat</a>`;

    await this.sendTelegramAlert(text);
  }

  static async notifyHighIntent(lead: any, message: string) {
    const sanitizedLead = sanitizeForTelegram(lead);
    const sanitizedMessage = '[REDACTED]'; // Never send message content to Telegram
    const dashboardUrl = `http://localhost:5173/`;
    const leadLink = `${dashboardUrl}?leadId=${lead.id}`;
    const text =
      `🔥 <b>High Intent Detected</b>\n\n` +
      `👤 <b>Lead:</b> ${sanitizedLead.name || 'Unknown'} (${sanitizedLead.phoneNumber})\n` +
      `💬 <b>Message:</b> "${sanitizedMessage}"\n\n` +
      `🔗 <a href="${leadLink}">Open Chat and Intervene</a>`;

    await this.sendTelegramAlert(text);
  }

  // NEW: Generic system error notification with cooldown
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

    // Send Telegram alert with sanitized data
    const icon = severity === 'CRITICAL' ? '🚨' : '⚠️';
    const message =
      `${icon} <b>${severity}</b>: ${context.category}\\n\\n` +
      `${context.error?.message || context.message}\\n\\n` +
      `Tenant: ${sanitizedContext.tenantId || 'N/A'}\\n` +
      `Time: ${new Date().toISOString()}`;

    await this.sendTelegramAlert(message);

    logger.error({ ...sanitizedContext, severity }, 'System error notification sent');
  }

  // NEW: Fatal error notification (critical failures requiring immediate attention)
  static async notifyFatalError(category: string, error: Error): Promise<void> {
    return this.notifySystemError('CRITICAL', {
      category,
      error,
      message: 'Fatal error occurred',
    });
  }

  // NEW: Infrastructure failure notification (DB/Redis/etc)
  static async notifyInfrastructureFailure(service: string, error: any): Promise<void> {
    return this.notifySystemError('CRITICAL', {
      category: `INFRASTRUCTURE_${service.toUpperCase()}`,
      error,
      message: `${service} infrastructure failure`,
    });
  }

  // NEW: AI service degradation notification
  static async notifyAIDegradation(leadId: string): Promise<void> {
    return this.notifySystemError('WARN', {
      category: 'AI_DEGRADATION',
      message: 'AI service unavailable, triggering human handover',
      leadId,
    });
  }

  // NEW: Message send failure notification (after retry exhaustion)
  static async notifyMessageFailure(leadId: string, error: Error): Promise<void> {
    return this.notifySystemError('WARN', {
      category: 'MESSAGE_SEND_FAILED',
      error,
      leadId,
    });
  }
}
