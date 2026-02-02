import { Request } from 'express';

export interface StandardMessageEvent {
  type: 'message' | 'status' | 'unknown';
  from: string;
  id: string; // Message ID
  timestamp: string;
  payload: any; // The actual content (text, image, status update)
  metadata?: any; // Extra context (e.g. phoneNumberId for multi-tenancy)
  raw: any; // The original raw event for debugging
}

export interface IWhatsAppProvider {
  name: string;
  sendMessage(to: string, type: 'text' | 'template' | 'interactive', payload: any): Promise<string>;
  sendTemplate(to: string, template: string, components: any[]): Promise<string>;
  validateWebhookSignature(req: Request): boolean;
  normalizeWebhook(payload: any): StandardMessageEvent[];
}
