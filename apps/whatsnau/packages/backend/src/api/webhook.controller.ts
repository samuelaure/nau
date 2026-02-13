import { Request, Response, Router } from 'express';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { Orchestrator } from '../core/orchestrator.js';
import { ProviderFactory } from '../core/providers/ProviderFactory.js';
import { inboundQueue } from '../infrastructure/queues/inbound.queue.js';

const router = Router();

/**
 * WhatsApp Webhook Verification (Handshake)
 */
router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
      logger.info('Webhook Verified Successfully');
      return res.status(200).set('Content-Type', 'text/plain').send(challenge);
    } else {
      logger.warn('Webhook Verification Failed: Token Mismatch');
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

/**
 * Handle Incoming WhatsApp Events
 */
import { db } from '../core/db.js';

// ... (router definition)

/**
 * Resolve Tenant ID from Webhook Payload
 */
async function resolveTenant(body: any): Promise<string | null> {
  let searchKey = '';

  // 1. Meta / Standard Payload
  if (body.object === 'whatsapp_business_account') {
    searchKey = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  }

  // 2. YCloud Payload
  // Type: whatsapp.message.incoming | whatsapp.message.updated
  if (body.type?.startsWith('whatsapp') && body.whatsappMessage) {
    // YCloud 'to' is the business number (Sender ID)
    searchKey = body.whatsappMessage.to;

    // Sometimes YCloud sends just the number, sometimes with +. 
    // We might need to handle normalization. 
    // For now assuming strict match with DB config.
  }

  if (!searchKey) return null;

  const conf = await db.whatsAppConfig.findFirst({
    where: { phoneNumberId: searchKey },
    select: { tenantId: true },
  });

  return conf?.tenantId || null;
}

/**
 * Handle Incoming WhatsApp Events
 */
router.post('/', async (req: Request, res: Response) => {
  const body = req.body;

  // 1. Resolve Tenant
  const tenantId = await resolveTenant(body);

  if (!tenantId) {
    // If we can't identify the tenant, we can't process the webhook (no credentials)
    // We log it but return 200 to acknowledge receipt and prevent retries of junk data.
    logger.warn({ bodySample: JSON.stringify(body).substring(0, 100) }, 'Webhook received but Tenant not found');
    return res.status(200).send('OK');
  }

  // 2. Get Provider for Tenant
  const provider = ProviderFactory.getProvider(tenantId);

  // 3. Validate Signature
  const isValid = await provider.validateWebhookSignature(req);
  if (!isValid) {
    logger.warn({ tenantId }, 'Webhook Verification Failed: Invalid Signature');
    return res.sendStatus(403);
  }

  // Sanitized logging for incoming webhook payloads (avoid PII exposure)
  // ... (keep existing logging)
  const webhookMetadata = {
    bodySize: JSON.stringify(body).length,
    tenantId,
    entryCount: body.entry?.length || 0,
    messageType: body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type,
  };
  logger.info(webhookMetadata, 'Incoming WhatsApp Webhook');

  try {
    const events = provider.normalizeWebhook(body);

    for (const event of events) {
      if (event.type === 'message' || event.type === 'status') {
        // Enriched with Tenant ID if not already present in metadata
        if (!event.metadata) event.metadata = {};
        event.metadata.tenantId = tenantId;

        // Decoupled Processing: Push to Queue
        await inboundQueue.add(
          'inbound-event',
          { event },
          {
            jobId: event.id, // Prevent duplicates (deduplication by message ID)
            removeOnComplete: true,
          }
        );

        logger.info({ type: event.type, id: event.id, tenantId }, 'Event queued for processing');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error normalizing webhook');
  }

  return res.status(200).send('OK');
});

export default router;
