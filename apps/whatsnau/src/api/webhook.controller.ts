import { Request, Response, Router } from 'express';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';

const router = Router();

/**
 * WhatsApp Webhook Verification (Handshake)
 */
router.get('/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
            logger.info('Webhook Verified Successfully');
            return res.status(200).send(challenge);
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
router.post('/whatsapp', async (req: Request, res: Response) => {
    const body = req.body;

    // Log full body in development to understand Meta payloads
    logger.debug({ body }, 'Incoming WhatsApp Webhook');

    if (body.object) {
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0] &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from; // Phone number
            const text = message.text?.body;
            const buttonResponse = message.interactive?.button_reply?.id;

            logger.info({ from, text, buttonResponse }, 'Received message from WhatsApp');

            // TODO: Call Orchestrator to process the logic
            // await Orchestrator.handleIncoming(from, text || buttonResponse);
        }
        return res.sendStatus(200);
    } else {
        return res.sendStatus(404);
    }
});

export default router;
