import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { logger } from './core/logger.js';
import { db } from './core/db.js';
import { CampaignService } from './services/campaign.service.js';
import webhookRouter from './api/webhook.controller.js';
import dashboardRouter from './api/dashboard.controller.js';
import importRouter from './api/import.controller.js';

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
        app.use(cors()); // Enable CORS for Dashboard
        app.use(bodyParser.json());

        // Routes
        app.use('/api', webhookRouter);
        app.use('/api/dashboard', dashboardRouter);
        app.use('/api/dashboard/import', importRouter);

        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            logger.info(`🌐 Server running on port ${port}`);
        });

        // Run follow-up check every 5 minutes
        setInterval(async () => {
            try {
                const { SequenceService } = await import('./services/sequence.service.js');
                await SequenceService.processFollowUps();
            } catch (error) {
                logger.error({ err: error }, 'Error in sequence interval');
            }
        }, 5 * 60 * 1000);

        logger.info('🛠 Platform initialized in Campaign-First mode');
    } catch (error) {
        logger.error({ err: error }, '❌ Failed to initialize platform');
        process.exit(1);
    }
}

bootstrap();
