import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { withRetry } from '../core/errors/withRetry.js';
import { ExternalServiceError } from '../core/errors/AppError.js';

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
  private static baseUrl = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  static async sendMessage(payload: WhatsAppMessagePayload) {
    return withRetry(
      async () => {
        logger.info({ to: payload.to, type: payload.type }, 'Sending WhatsApp message');

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
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
    components: any[] = []
  ) {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    });
  }

  static async sendText(to: string, text: string) {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    });
  }

  /**
   * Send interactive message with buttons (Quick Reply)
   * @param to - Phone number
   * @param bodyText - Message body text
   * @param buttons - Array of buttons (max 3)
   */
  static async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; text: string }>
  ) {
    // WhatsApp allows max 3 buttons
    if (buttons.length > 3) {
      logger.warn({ buttonCount: buttons.length }, 'Too many buttons, truncating to 3');
      buttons = buttons.slice(0, 3);
    }

    return this.sendMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText,
        },
        action: {
          buttons: buttons.map((btn, index) => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.text.substring(0, 20), // Max 20 chars for button text
            },
          })),
        },
      },
    });
  }

  /**
   * Send interactive message with list (up to 10 options)
   * @param to - Phone number
   * @param bodyText - Message body text
   * @param buttonText - Text for the list button
   * @param sections - Array of list sections with rows
   */
  static async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ) {
    return this.sendMessage({
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
    });
  }

  static async getTemplates() {
    return withRetry(async () => {
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}` },
      });
      if (!res.ok) throw new ExternalServiceError('WhatsApp', 'Failed to fetch templates');
      return res.json();
    });
  }

  static async createTemplate(name: string, category: string, language: string, components: any[]) {
    return withRetry(async () => {
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, category, language, components }),
      });
      if (!res.ok)
        throw new ExternalServiceError('WhatsApp', 'Failed to create template', await res.json());
      return res.json();
    });
  }

  static async deleteTemplate(name: string) {
    return withRetry(async () => {
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?name=${name}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}` },
      });
      if (!res.ok) throw new ExternalServiceError('WhatsApp', 'Failed to delete template');
      return res.json();
    });
  }

  static async verifyNumbers(phoneNumbers: string[]) {
    return withRetry(async () => {
      const url = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/contacts`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
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
}
