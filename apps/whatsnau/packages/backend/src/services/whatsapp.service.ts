import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { withRetry } from '../core/errors/withRetry.js';
import { ExternalServiceError } from '../core/errors/AppError.js';
import { db } from '../core/db.js';
import { CircuitBreaker } from '../core/resilience/CircuitBreaker.js';
import { PerformanceMonitor } from '../core/observability/PerformanceMonitor.js';
import { NotificationService } from './notification.service.js';
import { getCorrelationId } from '../core/observability/CorrelationId.js';

export interface WhatsAppMessagePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'template' | 'interactive';
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: any[];
  };
  interactive?: any;
}

export class WhatsAppService {
  private static whatsappCircuitBreaker = new CircuitBreaker('WhatsApp', {
    failureThreshold: 5,
    timeout: 60000,
  });
  /**
   * Helper to get the most relevant credentials (Campaign-specific > Tenant Default > .env)
   */
  private static async getCredentials(tenantId: string, campaignId?: string) {
    try {
      // 1. Try to find config for a specific campaign if provided
      if (campaignId) {
        const campaign = await db.campaign.findUnique({
          where: { id: campaignId },
          include: { whatsAppConfig: true },
        } as any);

        const config = (campaign as any)?.whatsAppConfig;
        if (config) {
          return {
            accessToken: config.accessToken,
            phoneNumberId: config.phoneNumberId,
            wabaId: config.wabaId,
          };
        }
      }

      // 2. Try to find the default config for the tenant in DB
      const defaultConfig = await (db as any).whatsAppConfig.findFirst({
        where: { tenantId, isDefault: true },
      });

      if (defaultConfig) {
        return {
          accessToken: defaultConfig.accessToken as string,
          phoneNumberId: defaultConfig.phoneNumberId as string,
          wabaId: defaultConfig.wabaId as string,
        };
      }
    } catch (err) {
      logger.warn({ err, tenantId }, 'Failed to fetch WhatsApp config from DB, falling back to .env');
    }

    // 3. Fallback to .env config (Global/Legacy)
    return {
      accessToken: config.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
      wabaId: config.WHATSAPP_BUSINESS_ACCOUNT_ID,
    };
  }

  static async sendMessage(tenantId: string, payload: WhatsAppMessagePayload, campaignId?: string) {
    const correlationId = getCorrelationId();

    try {
      return await this.whatsappCircuitBreaker.execute(() =>
        PerformanceMonitor.track('WHATSAPP_SEND', async () => {
          return withRetry(
            async () => {
              const creds = await this.getCredentials(tenantId, campaignId);
              const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${creds.phoneNumberId}/messages`;

              logger.info(
                { to: payload.to, type: payload.type, correlationId, campaignId },
                'Sending WhatsApp message'
              );

              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${creds.accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });

              const data = await response.json();

              if (!response.ok) {
                throw new ExternalServiceError('WhatsApp', 'API Request Failed', data);
              }

              logger.info(
                {
                  messageId: (data as any).messages?.[0]?.id,
                  correlationId,
                  to: payload.to,
                },
                'WhatsApp message sent successfully'
              );
              return data;
            },
            {
              retries: 3,
              delay: 500,
            }
          );
        })
      );
    } catch (error: any) {
      logger.error(
        {
          err: error,
          correlationId,
          to: payload.to,
          circuitState: this.whatsappCircuitBreaker.getState(),
        },
        'WhatsApp sendMessage failed'
      );

      if (this.whatsappCircuitBreaker.getState() === 'OPEN') {
        const lead = await db.lead.findFirst({ where: { phoneNumber: payload.to } });
        await NotificationService.notifySystemError('WARN', {
          category: 'WHATSAPP_CIRCUIT_OPEN',
          message: 'WhatsApp circuit is OPEN, message could not be sent',
          leadId: lead?.id,
          recipient: payload.to,
        });
      }

      throw error;
    }
  }

  static async sendTemplate(
    tenantId: string,
    to: string,
    templateName: string,
    languageCode = 'es_ES',
    components: any[] = [],
    campaignId?: string
  ) {
    return this.sendMessage(
      tenantId,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      },
      campaignId
    );
  }

  static async sendText(tenantId: string, to: string, text: string, campaignId?: string) {
    return this.sendMessage(
      tenantId,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      campaignId
    );
  }

  /**
   * Send interactive message with buttons (Quick Reply)
   */
  static async sendInteractiveButtons(
    tenantId: string,
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; text: string }>,
    campaignId?: string
  ) {
    if (buttons.length > 3) {
      logger.warn({ buttonCount: buttons.length }, 'Too many buttons, truncating to 3');
      buttons = buttons.slice(0, 3);
    }

    return this.sendMessage(
      tenantId,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: bodyText,
          },
          action: {
            buttons: buttons.map((btn) => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.text.substring(0, 20),
              },
            })),
          },
        },
      },
      campaignId
    );
  }

  /**
   * Send interactive message with list
   */
  static async sendInteractiveList(
    tenantId: string,
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    campaignId?: string
  ) {
    return this.sendMessage(
      tenantId,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: bodyText,
          },
          action: {
            button: buttonText,
            sections,
          },
        },
      },
      campaignId
    );
  }

  static async getTemplates(tenantId: string, campaignId?: string) {
    // First, check if we have valid credentials in the database
    try {
      const hasValidConfig = await this.hasValidWhatsAppConfig(tenantId, campaignId);
      if (!hasValidConfig) {
        logger.info(
          'WhatsApp not yet configured in database, skipping template fetch to avoid API spam'
        );
        return { data: [] };
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to check WhatsApp config, skipping template fetch');
      return { data: [] };
    }

    const creds = await this.getCredentials(tenantId, campaignId);
    if (!creds.accessToken || creds.accessToken.includes('YOUR_') || !creds.wabaId) {
      logger.info('WhatsApp not configured or using placeholders, skipping template fetch');
      return { data: [] };
    }

    return withRetry(async () => {
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${creds.wabaId}/message_templates`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      if (!res.ok) throw new ExternalServiceError('WhatsApp', 'Failed to fetch templates');
      return res.json();
    });
  }

  /**
   * Check if we have a valid WhatsApp configuration in the database
   * Returns false if no config exists or if credentials are missing/invalid
   */
  private static async hasValidWhatsAppConfig(tenantId: string, campaignId?: string): Promise<boolean> {
    try {
      // Check campaign-specific config first
      if (campaignId) {
        const campaign = await db.campaign.findUnique({
          where: { id: campaignId },
          include: { whatsAppConfig: true },
        } as any);

        const config = (campaign as any)?.whatsAppConfig;
        if (config?.accessToken && config?.wabaId && !config.accessToken.includes('YOUR_')) {
          return true;
        }
      }

      // Check default config in DB
      const defaultConfig = await (db as any).whatsAppConfig.findFirst({
        where: { tenantId, isDefault: true },
      });

      if (
        defaultConfig?.accessToken &&
        defaultConfig?.wabaId &&
        !defaultConfig.accessToken.includes('YOUR_')
      ) {
        return true;
      }

      return false;
    } catch (err) {
      logger.warn({ err }, 'Error checking WhatsApp config validity');
      return false;
    }
  }

  static async createTemplate(
    tenantId: string,
    name: string,
    category: string,
    language: string,
    components: any[],
    campaignId?: string
  ) {
    return withRetry(async () => {
      const creds = await this.getCredentials(tenantId, campaignId);
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${creds.wabaId}/message_templates`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, category, language, components }),
      });
      if (!res.ok)
        throw new ExternalServiceError('WhatsApp', 'Failed to create template', await res.json());
      return res.json();
    });
  }

  static async deleteTemplate(tenantId: string, name: string, campaignId?: string) {
    return withRetry(async () => {
      const creds = await this.getCredentials(tenantId, campaignId);
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${creds.wabaId}/message_templates?name=${name}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      if (!res.ok) throw new ExternalServiceError('WhatsApp', 'Failed to delete template');
      return res.json();
    });
  }

  static async verifyNumbers(tenantId: string, phoneNumbers: string[], campaignId?: string) {
    return withRetry(async () => {
      const creds = await this.getCredentials(tenantId, campaignId);
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${creds.phoneNumberId}/contacts`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          contacts: phoneNumbers.map((p) => (p.startsWith('+') ? p : `+${p}`)),
          blocking: 'wait',
        }),
      });
      if (!res.ok) throw new ExternalServiceError('WhatsApp', 'Failed to verify numbers');
      return res.json();
    });
  }

  static async sendTemplateWithVariables(
    tenantId: string,
    to: string,
    templateName: string,
    components: any[],
    languageCode = 'es_ES',
    campaignId?: string
  ) {
    logger.info({ to, templateName }, 'Sending WhatsApp template with variables');
    return this.sendTemplate(tenantId, to, templateName, languageCode, components, campaignId);
  }

  static async canSendFreeform(leadId: string): Promise<boolean> {
    const { db } = await import('../core/db.js');

    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        messages: {
          where: { direction: 'INBOUND' },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    if (!lead || !lead.messages || lead.messages.length === 0) {
      return false;
    }

    const lastInbound = lead.messages[0];
    const hoursSinceLastInbound =
      (Date.now() - new Date(lastInbound.timestamp).getTime()) / (1000 * 60 * 60);

    return hoursSinceLastInbound < 24;
  }
}
