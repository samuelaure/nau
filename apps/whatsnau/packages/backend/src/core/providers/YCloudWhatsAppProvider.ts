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
    const signature = req.headers['x-ycloud-signature'] as string;
    if (!signature) return false;

    // TODO: Verify signature using HMAC-SHA256 with API Key or Webhook Secret
    return true;
  }

  normalizeWebhook(payload: any): StandardMessageEvent[] {
    const events: StandardMessageEvent[] = [];

    // YCloud webhook structure handling (placeholder)
    // Needs actual YCloud payload structure
    // Example: { data: [ { id: ..., from: ..., type: ..., text: ... } ] }
    if (payload.data && Array.isArray(payload.data)) {
      for (const item of payload.data) {
        // Basic mapping
        events.push({
          type: 'message', // or determine from item
          from: item.from,
          id: item.id,
          timestamp: item.timestamp,
          payload: item,
          raw: item,
        });
      }
    }

    return events;
  }
}
