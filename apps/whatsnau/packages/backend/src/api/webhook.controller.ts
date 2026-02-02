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
router.post('/', async (req: Request, res: Response) => {
  const body = req.body;
  const provider = ProviderFactory.getProvider();

  // Validate Signature if provider requires it
  // Note: YCloud might handle validation differently or use middleware
  if (config.WHATSAPP_PROVIDER === 'meta' && !provider.validateWebhookSignature(req)) {
    logger.warn('Webhook Verification Failed: Invalid Signature');
    return res.sendStatus(403);
  }

  // Verbose logging for all incoming webhook payloads
  logger.info({ body }, 'Incoming WhatsApp Webhook');

  try {
    const events = provider.normalizeWebhook(body);

    for (const event of events) {
      if (event.type === 'message' || event.type === 'status') {
        // Decoupled Processing: Push to Queue
        await inboundQueue.add(
          'inbound-event',
          { event },
          {
            jobId: event.id, // Prevent duplicates (deduplication by message ID)
            removeOnComplete: true,
          }
        );

        logger.info({ type: event.type, id: event.id }, 'Event queued for processing');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error normalizing webhook');
  }

  return res.status(200).send('OK');
});

export default router;
