import express from 'express';
import bodyParser from 'body-parser';
import { logger } from './core/logger.js';
import { db } from './core/db.js';
import { CampaignService } from './services/campaign.service.js';
import webhookRouter from './api/webhook.controller.js';

async function bootstrap() {
    logger.info('🚀 whatsnaŭ is starting...');

    try {
        // Basic connectivity check
        await db.$connect();
        logger.info('✅ Database connected successfully');

        // Seed reference campaign
        await CampaignService.seedReferenceCampaign();

        // Setup Express
        const app = express();
        app.use(bodyParser.json());

        // Routes
        app.use('/api', webhookRouter);

        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            logger.info(`🌐 Server running on port ${port}`);
        });

        logger.info('🛠 Platform initialized in Campaign-First mode');
    } catch (error) {
        logger.error({ err: error }, '❌ Failed to initialize platform');
        process.exit(1);
    }
}

bootstrap();
