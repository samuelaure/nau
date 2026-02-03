import { Request } from 'express';
import crypto from 'crypto';
import { IWhatsAppProvider, StandardMessageEvent } from './IWhatsAppProvider.js';
import { WhatsAppService } from '../../services/whatsapp.service.js';
import { config } from '../config.js';

export class MetaWhatsAppProvider implements IWhatsAppProvider {
  name = 'meta';

  constructor(private campaignId?: string) {}

  async sendMessage(
    to: string,
    type: 'text' | 'template' | 'interactive',
    payload: any
  ): Promise<string> {
    // Construct the payload expected by WhatsAppService
    const metaPayload: any = {
      messaging_product: 'whatsapp',
      to,
      type,
    };

    if (type === 'text') {
      metaPayload.text = payload.text || { body: payload.body };
    } else if (type === 'template') {
      metaPayload.template = {
        name: payload.name,
        language: payload.language || { code: 'es_ES' },
        components: payload.components,
      };
    } else if (type === 'interactive') {
      metaPayload.interactive = payload.interactive || payload;
    }

    const res = await WhatsAppService.sendMessage(metaPayload, this.campaignId);
    return (res as any)?.messages?.[0]?.id || '';
  }

  async sendTemplate(to: string, template: string, components: any[]): Promise<string> {
    const res = await WhatsAppService.sendTemplate(to, template, 'es', components, this.campaignId);
    return (res as any)?.messages?.[0]?.id || '';
  }

  validateWebhookSignature(req: Request): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return false; // Signature is required for security

    const elements = signature.split('=');
    const method = elements[0];
    const signatureHash = elements[1];

    // TODO: Get APP_SECRET based on campaign/config
    const appSecret = config.META_APP_SECRET;

    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update((req as any).rawBody || JSON.stringify(req.body));
    const expectedHash = hmac.digest('hex');

    return signatureHash === expectedHash;
  }

  normalizeWebhook(payload: any): StandardMessageEvent[] {
    const events: StandardMessageEvent[] = [];
    const entry = payload.entry?.[0];
    const changes = entry?.changes || [];

    for (const change of changes) {
      if (change.field === 'messages') {
        const value = change.value;

        // Handle Inbound/Outbound Messages
        if (value.messages) {
          for (const msg of value.messages) {
            const businessNumber = value.metadata?.display_phone_number;
            const direction = msg.from === businessNumber ? 'OUTBOUND' : 'INBOUND';

            events.push({
              type: 'message',
              direction,
              from: direction === 'INBOUND' ? msg.from : msg.to || 'unknown',
              id: msg.id,
              timestamp: msg.timestamp,
              payload: {
                text: msg.text?.body,
                type: msg.type,
                buttonId: msg.interactive?.button_reply?.id,
                ...msg,
              },
              metadata: {
                phoneNumberId: value.metadata?.phone_number_id,
                displayPhoneNumber: businessNumber,
              },
              raw: msg,
            });
          }
        }

        // Handle Status Updates (Always relate to OUTBOUND messages)
        if (value.statuses) {
          for (const status of value.statuses) {
            events.push({
              type: 'status',
              direction: 'OUTBOUND',
              from: status.recipient_id,
              id: status.id, // Message ID being updated
              timestamp: status.timestamp,
              payload: {
                status: status.status,
              },
              raw: status,
            });
          }
        }
      }
    }
    return events;
  }
}
