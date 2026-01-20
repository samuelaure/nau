import { config } from '../core/config.js';
import { logger } from '../core/logger.js';

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
        try {
            logger.info({ to: payload.to, type: payload.type }, 'Sending WhatsApp message');

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                logger.error({ data }, 'WhatsApp API Error');
                throw new Error(`WhatsApp API failed with status ${response.status}`);
            }

            logger.info({ messageId: (data as any).messages?.[0]?.id }, 'WhatsApp message sent successfully');
            return data;
        } catch (error) {
            logger.error({ err: error }, 'Failed to send WhatsApp message');
            throw error;
        }
    }

    static async sendTemplate(to: string, templateName: string, languageCode = 'es_ES', components: any[] = []) {
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
}
