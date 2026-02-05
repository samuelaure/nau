import express, { Request, Response, RequestHandler } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import bodyParser from 'body-parser';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './core/config.js';
import { logger } from './core/logger.js';
import { db, connectWithRetry } from './core/db.js';
import { CampaignService } from './services/campaign.service.js';
import { AuthService } from './services/auth.service.js';
import { authMiddleware } from './core/authMiddleware.js';
import webhookRouter from './api/webhook.controller.js';
import dashboardRouter from './api/dashboard.controller.js';
import importRouter from './api/import.controller.js';
import authRouter from './api/auth.controller.js';
import whatsappRouter from './api/whatsapp.controller.js';
import { errorMiddleware } from './core/errors/errorMiddleware.js';
import { correlationIdMiddleware } from './core/observability/CorrelationId.js';
import adminRouter from './api/admin.controller.js';
import { GracefulShutdown } from './core/resilience/GracefulShutdown.js';
import { withErrorBoundary } from './core/resilience/ErrorBoundary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Initialize Resilience Coordination
GracefulShutdown.initialize();

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://connect.facebook.net'],
        connectSrc: ["'self'", 'https://*.facebook.com', 'https://*.facebook.net'],
        frameSrc: ["'self'", 'https://*.facebook.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

const allowedOrigins = config.ALLOWED_ORIGINS.split(',');

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(correlationIdMiddleware as RequestHandler);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Admin & Observability
app.use('/api/admin', authMiddleware, adminRouter);
app.get('/health', async (req, res) => {
  const { HealthCheck } = await import('./core/observability/HealthCheck.js');
  const health = await HealthCheck.getSystemHealth();
  res.json(health);
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/webhooks/whatsapp', webhookRouter);
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/dashboard/import', authMiddleware, importRouter);
app.use('/api/whatsapp', authMiddleware, whatsappRouter);

import configRouter from './api/config.router.js';
app.use('/api/config', authMiddleware, configRouter);

// Frontend static files
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

app.get(/^(?!\/api).*/, (req: Request, res: Response) => {
  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend not found. Did you run npm run build in /frontend?');
    }
  });
});

app.use(errorMiddleware);

async function bootstrap() {
  logger.info('🚀 whatsnaŭ is starting...');

  try {
    // 1. Database Connection with Retry
    await connectWithRetry();

    // 2. Seeding
    await AuthService.seedAdmin();
    await CampaignService.seedReferenceCampaign();

    // 3. Start Server
    const port = process.env.PORT || 3000;
    const server = app.listen(port, () => {
      logger.info(`🌐 Server running on port ${port}`);

      // Initialize Workers
      import('./infrastructure/workers/index.js')
        .then(({ initWorkers }) => {
          initWorkers();
        })
        .catch((err) => {
          logger.error({ err }, 'Failed to initialize workers');
        });
    });

    // 4. Register for Graceful Shutdown
    GracefulShutdown.registerServer(server);

    // 5. Periodic Tasks (Wrapped in Error Boundary)
    setInterval(
      () =>
        withErrorBoundary(
          async () => {
            const { SequenceService } = await import('./services/sequence.service.js');
            await SequenceService.processFollowUps();
          },
          { category: 'SEQUENCE_SYNC', severity: 'WARN' }
        ),
      5 * 60 * 1000
    );

    logger.info('🛠 Platform initialized with Resilience Hardening');
  } catch (error) {
    logger.fatal({ err: error }, '❌ Fatal error during bootstrap');
    await GracefulShutdown.initiate('BOOTSTRAP_FAILED', error as Error);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
