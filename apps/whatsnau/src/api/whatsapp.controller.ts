import { Router } from 'express';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { asyncHandler } from '../core/errors/asyncHandler.js';
import { authMiddleware } from '../core/authMiddleware.js';
import { db } from '../core/db.js';

const router = Router();

/**
 * @route POST /api/whatsapp/onboard
 * @desc Exchanges an Embedded Signup code for a permanent access token and stores it.
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

    logger.info({ phone_number_id, waba_id }, 'Exchanging setup code for permanent access token');

    try {
      // 1. Exchange code for access token (POST method with JSON body)
      const tokenUrl = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/oauth/access_token`;

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.META_APP_ID,
          client_secret: config.META_APP_SECRET,
          grant_type: 'authorization_code',
          code: code,
          // Redirect URI is required by Meta and must match dashboard config
          // We use the primary production domain as the canonical redirect
          redirect_uri: 'https://whatsnau.9nau.com',
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        logger.error({ tokenData }, 'Failed to exchange code for token');
        return res.status(500).json({ error: 'Token exchange failed', details: tokenData });
      }

      const accessToken = tokenData.access_token;

      // 2. Persist to Database
      // We upsert the config based on the unique phoneNumberId
      const whatsappConfig = await (db as any).whatsAppConfig.upsert({
        where: { phoneNumberId: phone_number_id },
        update: {
          accessToken,
          wabaId: waba_id,
          updatedAt: new Date(),
        },
        create: {
          phoneNumberId: phone_number_id,
          wabaId: waba_id,
          accessToken,
          isDefault: true, // Mark the first/latest connected account as default
        },
      });

      logger.info(
        { waba_id, configId: whatsappConfig.id },
        'WhatsApp account successfully linked and stored'
      );

      res.json({
        success: true,
        data: {
          id: whatsappConfig.id,
          waba_id,
          phone_number_id,
          message: 'WhatsApp account successfully linked and persisted.',
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error during WhatsApp onboarding flow');
      return res.status(500).json({ error: 'Internal server error during onboarding' });
    }
  })
);

export default router;
