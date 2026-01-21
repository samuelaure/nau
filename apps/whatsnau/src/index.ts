import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { logger } from './core/logger.js';
import { db } from './core/db.js';
import { CampaignService } from './services/campaign.service.js';
import { AuthService } from './services/auth.service.js';
import { authMiddleware } from './core/authMiddleware.js';
import webhookRouter from './api/webhook.controller.js';
import dashboardRouter from './api/dashboard.controller.js';
import importRouter from './api/import.controller.js';
import authRouter from './api/auth.controller.js';
import { errorMiddleware } from './core/errors/errorMiddleware.js';

export const app = express();

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());

// Observability: Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api', webhookRouter); // Webhooks are usually public or use different auth
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/dashboard/import', authMiddleware, importRouter);

// Error Handling Middleware
app.use(errorMiddleware);

async function bootstrap() {
  logger.info('🚀 whatsnaŭ is starting...');

  try {
    await db.$connect();
    logger.info('✅ Database connected successfully');

    await AuthService.seedAdmin();
    await CampaignService.seedReferenceCampaign();

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.info(`🌐 Server running on port ${port}`);
    });

    setInterval(
      async () => {
        try {
          const { SequenceService } = await import('./services/sequence.service.js');
          await SequenceService.processFollowUps();
        } catch (error) {
          logger.error({ err: error }, 'Error in sequence interval');
        }
      },
      5 * 60 * 1000
    );

    logger.info('🛠 Platform initialized in Campaign-First mode');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to initialize platform');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
