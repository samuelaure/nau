import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { withRetry } from '../core/errors/withRetry.js';
import { ExternalServiceError } from '../core/errors/AppError.js';
import { db } from '../core/db.js';

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
  /**
   * Helper to get the most relevant credentials (Campaign-specific > Default DB > .env)
   */
  private static async getCredentials(campaignId?: string) {
    try {
      // 1. Try to find config for a specific campaign if provided
      if (campaignId) {
        const campaign = await db.campaign.findUnique({
          where: { id: campaignId },
          include: { whatsAppConfig: true },
        } as any);

        // Use Type Assertion if compiler still struggles with include
        const config = (campaign as any)?.whatsAppConfig;
        if (config) {
          return {
            accessToken: config.accessToken,
            phoneNumberId: config.phoneNumberId,
            wabaId: config.wabaId,
          };
        }
      }

      // 2. Try to find the default config in DB
      // We use type assertion to bypass temporary Prisma type sync lag in IDE
      const defaultConfig = await (db as any).whatsAppConfig.findFirst({
        where: { isDefault: true },
      });

      if (defaultConfig) {
        return {
          accessToken: defaultConfig.accessToken as string,
          phoneNumberId: defaultConfig.phoneNumberId as string,
          wabaId: defaultConfig.wabaId as string,
        };
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch WhatsApp config from DB, falling back to .env');
    }

    // 3. Fallback to .env config
    return {
      accessToken: config.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
      wabaId: config.WHATSAPP_BUSINESS_ACCOUNT_ID,
    };
  }

  static async sendMessage(payload: WhatsAppMessagePayload, campaignId?: string) {
    return withRetry(
      async () => {
        const creds = await this.getCredentials(campaignId);
        const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${creds.phoneNumberId}/messages`;

        logger.info({ to: payload.to, type: payload.type }, 'Sending WhatsApp message');

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
          { messageId: (data as any).messages?.[0]?.id },
          'WhatsApp message sent successfully'
        );
        return data;
      },
      {
        retries: 3,
        delay: 500,
      }
    );
  }

  static async sendTemplate(
    to: string,
    templateName: string,
    languageCode = 'es_ES',
    components: any[] = [],
    campaignId?: string
  ) {
    return this.sendMessage(
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

  static async sendText(to: string, text: string, campaignId?: string) {
    return this.sendMessage(
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

  static async getTemplates(campaignId?: string) {
    return withRetry(async () => {
      const creds = await this.getCredentials(campaignId);
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${creds.wabaId}/message_templates`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      if (!res.ok) throw new ExternalServiceError('WhatsApp', 'Failed to fetch templates');
      return res.json();
    });
  }

  static async createTemplate(
    name: string,
    category: string,
    language: string,
    components: any[],
    campaignId?: string
  ) {
    return withRetry(async () => {
      const creds = await this.getCredentials(campaignId);
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

  static async deleteTemplate(name: string, campaignId?: string) {
    return withRetry(async () => {
      const creds = await this.getCredentials(campaignId);
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${creds.wabaId}/message_templates?name=${name}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      if (!res.ok) throw new ExternalServiceError('WhatsApp', 'Failed to delete template');
      return res.json();
    });
  }

  static async verifyNumbers(phoneNumbers: string[], campaignId?: string) {
    return withRetry(async () => {
      const creds = await this.getCredentials(campaignId);
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
    to: string,
    templateName: string,
    components: any[],
    languageCode = 'es_ES',
    campaignId?: string
  ) {
    logger.info({ to, templateName }, 'Sending WhatsApp template with variables');
    return this.sendTemplate(to, templateName, languageCode, components, campaignId);
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
