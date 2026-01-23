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

  // Verbose logging for all incoming webhook payloads
  logger.info({ body }, 'Incoming WhatsApp Webhook');

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];

    if (change) {
      const { field, value } = change;
      logger.info({ field, value, wabaId: entry.id }, `WhatsApp Event: ${field}`);

      // 1. Handle Messages
      if (field === 'messages') {
        const message = value.messages?.[0];
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
        }

        // Handle Status Updates (sent, delivered, read) which also come under 'messages' field in some API versions
        const status = value.statuses?.[0];
        if (status) {
          const messageId = status.id;
          const deliveryStatus = status.status;
          logger.info({ messageId, deliveryStatus }, 'Processing WhatsApp status update');
          try {
            await Orchestrator.handleStatusUpdate(messageId, deliveryStatus);
          } catch (error) {
            logger.error({ err: error, messageId }, 'Error in Orchestrator status handling');
          }
        }
      }

      // 2. Log specific business events for user testing
      if (
        [
          'history',
          'smb_app_state_sync',
          'smb_message_echoes',
          'business_status_update',
          'message_template_status_update',
          'phone_number_quality_update',
          'account_update',
          'template_category_update',
        ].includes(field)
      ) {
        logger.info({ field, data: value }, `Special Meta Event Received: ${field}`);
      }
    }

    return res.status(200).send('OK');
  } else {
    // If it's not a WABA object, it might be a different type of webhook or 404
    return res.status(200).send('Event received');
  }
});

export default router;
