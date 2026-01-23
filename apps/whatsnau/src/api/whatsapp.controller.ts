import { Router } from 'express';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { asyncHandler } from '../core/errors/asyncHandler.js';
import { authMiddleware } from '../core/authMiddleware.js';

const router = Router();

/**
 * @route POST /api/whatsapp/onboard
 * @desc Exchanges an Embedded Signup code for a permanent access token
 * @access Protected
 */
router.post(
  '/onboard',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { code, phone_number_id, waba_id } = req.body;

    if (!code || !phone_number_id || !waba_id) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    logger.info({ phone_number_id, waba_id }, 'Exchanging setup code for access token');

    // 1. Exchange code for access token
    const tokenUrl =
      `https://graph.facebook.com/${config.WHATSAPP_VERSION}/oauth/access_token?` +
      new URLSearchParams({
        client_id: config.META_APP_ID,
        client_secret: config.META_APP_SECRET,
        code: code,
      }).toString();

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      logger.error({ tokenData }, 'Failed to exchange code for token');
      return res.status(500).json({ error: 'Token exchange failed', details: tokenData });
    }

    const accessToken = tokenData.access_token;

    // 2. Implementation Note:
    // In whatsnau, we should ideally save this to the global config or a specific business entity.
    // For now, we log it and return success to the frontend.
    logger.info({ waba_id }, 'Successfully retrieved permanent access token');

    // TODO: Update Prisma/Database with these new credentials if needed
    // Example: await db.config.updateMany({ data: { WHATSAPP_ACCESS_TOKEN: accessToken, ... } });

    res.json({
      success: true,
      data: {
        waba_id,
        phone_number_id,
        message: 'WhatsApp account successfully linked',
      },
    });
  })
);

export default router;
