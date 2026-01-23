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

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
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
          redirect_uri: 'https://whatsnau.9nau.com/',
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        logger.error({ tokenData }, 'Failed to exchange code for token');
        return res.status(500).json({ error: 'Token exchange failed', details: tokenData });
      }

      const accessToken = tokenData.access_token;

      // 2. If phone_number_id or waba_id are missing, fetch them from Meta
      let finalPhoneNumberId = phone_number_id;
      let finalWabaId = waba_id;

      if (!finalPhoneNumberId || !finalWabaId) {
        logger.info('phone_number_id or waba_id missing, fetching from Meta API...');

        // Fetch the WABA ID from the debug_token endpoint
        const debugUrl = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
        const debugRes = await fetch(debugUrl);
        const debugData = await debugRes.json();

        if (debugData.data?.granular_scopes) {
          // Extract WABA ID from scopes
          const wabaScope = debugData.data.granular_scopes.find((s: any) =>
            s.scope.includes('whatsapp_business_management')
          );
          if (wabaScope?.target_ids?.[0]) {
            finalWabaId = wabaScope.target_ids[0];
          }
        }

        // Fetch phone number IDs for this WABA
        if (finalWabaId) {
          const phoneUrl = `https://graph.facebook.com/${config.WHATSAPP_VERSION}/${finalWabaId}/phone_numbers?access_token=${accessToken}`;
          const phoneRes = await fetch(phoneUrl);
          const phoneData = await phoneRes.json();

          if (phoneData.data?.[0]?.id) {
            finalPhoneNumberId = phoneData.data[0].id;
          }
        }

        logger.info({ finalPhoneNumberId, finalWabaId }, 'Fetched missing IDs from Meta API');
      }

      if (!finalPhoneNumberId || !finalWabaId) {
        logger.error('Could not determine phone_number_id or waba_id');
        return res.status(400).json({
          error: 'Could not determine WhatsApp Business Account details',
        });
      }

      // 3. Persist to Database
      // We upsert the config based on the unique phoneNumberId
      const whatsappConfig = await (db as any).whatsAppConfig.upsert({
        where: { phoneNumberId: finalPhoneNumberId },
        update: {
          accessToken,
          wabaId: finalWabaId,
          updatedAt: new Date(),
        },
        create: {
          phoneNumberId: finalPhoneNumberId,
          wabaId: finalWabaId,
          accessToken,
          isDefault: true, // Mark the first/latest connected account as default
        },
      });

      logger.info(
        { waba_id: finalWabaId, configId: whatsappConfig.id },
        'WhatsApp account successfully linked and stored'
      );

      res.json({
        success: true,
        data: {
          id: whatsappConfig.id,
          waba_id: finalWabaId,
          phone_number_id: finalPhoneNumberId,
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
