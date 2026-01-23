import { Request, Response, Router } from 'express';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { Orchestrator } from '../core/orchestrator.js';

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

  if (body.object) {
    const changes = body.entry?.[0]?.changes?.[0]?.value;
    if (!changes) return res.status(200).send('OK');

    const message = changes.messages?.[0];
    const status = changes.statuses?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;
      const buttonId = message.interactive?.button_reply?.id;
      const whatsappId = message.id;

      const isOutbound = from === config.WHATSAPP_PHONE_NUMBER;
      const direction = isOutbound ? 'OUTBOUND' : 'INBOUND';
      const targetPhone = isOutbound ? (message as any).to : from;

      logger.info(
        { from, targetPhone, direction, text, whatsappId },
        'Processing WhatsApp message'
      );

      try {
        await Orchestrator.handleIncoming(targetPhone, text, buttonId, direction, whatsappId);
      } catch (error) {
        logger.error({ err: error, from }, 'Error in Orchestrator message handling');
      }
    } else if (status) {
      const messageId = status.id;
      const deliveryStatus = status.status; // sent, delivered, read, failed

      logger.info({ messageId, deliveryStatus }, 'Processing WhatsApp status update');

      try {
        await Orchestrator.handleStatusUpdate(messageId, deliveryStatus);
      } catch (error) {
        logger.error({ err: error, messageId }, 'Error in Orchestrator status handling');
      }
    }
    return res.status(200).send('OK');
  } else {
    return res.sendStatus(404);
  }
});

export default router;
