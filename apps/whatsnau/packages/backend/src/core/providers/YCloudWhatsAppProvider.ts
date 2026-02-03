import { Request } from 'express';
import crypto from 'crypto';
import { IWhatsAppProvider, StandardMessageEvent } from './IWhatsAppProvider.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export class YCloudWhatsAppProvider implements IWhatsAppProvider {
  name = 'ycloud';
  private apiKey: string;

  constructor() {
    this.apiKey = config.YCLOUD_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('YCloud API Key is missing');
    }
  }

  async sendMessage(
    to: string,
    type: 'text' | 'template' | 'interactive',
    payload: any
  ): Promise<string> {
    const url = 'https://api.ycloud.com/v2/whatsapp/messages';

    const body: any = {
      to,
      type,
    };

    if (type === 'text') {
      body.text = payload.text || { body: payload.body };
    } else if (type === 'template') {
      body.template = {
        name: payload.name,
        language: payload.language || { code: 'es_ES' },
        components: payload.components,
      };
    } else if (type === 'interactive') {
      body.interactive = payload.interactive || payload;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`YCloud Error: ${JSON.stringify(data)}`);
    }

    return data.id || '';
  }

  async sendTemplate(to: string, template: string, components: any[]): Promise<string> {
    return this.sendMessage(to, 'template', {
      name: template,
      language: { code: 'es' },
      components,
    });
  }

  validateWebhookSignature(req: Request): boolean {
    const signatureHeader = req.headers['x-ycloud-signature'] as string;
    if (!signatureHeader) return false;

    // YCloud header format: t=... ,v1=...
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signaturePart = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) return false;

    const timestamp = timestampPart.split('=')[1];
    const signature = signaturePart.split('=')[1];
    const body = JSON.stringify(req.body);

    const signedPayload = `${timestamp}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.apiKey)
      .update(signedPayload)
      .digest('hex');

    // Time-constant comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  normalizeWebhook(payload: any): StandardMessageEvent[] {
    const events: StandardMessageEvent[] = [];

    // YCloud v2 Webhook Structure
    // { "type": "whatsapp.message.incoming", "whatsappMessage": { ... } }
    // Reference: https://docs.ycloud.com/api-reference/whatsapp/webhooks

    if (payload.type === 'whatsapp.message.incoming' && payload.whatsappMessage) {
      const msg = payload.whatsappMessage;
      events.push({
        type: 'message',
        direction: 'INBOUND',
        from: msg.from,
        id: msg.id,
        timestamp: msg.timestamp,
        payload: {
          text: msg.text?.body,
          type: msg.type,
          context: msg.context,
        },
        raw: payload,
      });
    }

    // Handle status updates
    // { "type": "whatsapp.message.updated", "whatsappMessage": { ... } }
    if (payload.type === 'whatsapp.message.updated' && payload.whatsappMessage) {
      const msg = payload.whatsappMessage;
      events.push({
        type: 'status',
        direction: 'OUTBOUND',
        from: msg.from,
        id: msg.id,
        timestamp: msg.timestamp,
        payload: {
          status: msg.status,
        },
        raw: payload,
      });
    }

    return events;
  }
}
