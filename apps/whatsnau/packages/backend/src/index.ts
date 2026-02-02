import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import bodyParser from 'body-parser';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { logger } from './core/logger.js';
import { db } from './core/db.js';
import { CampaignService } from './services/campaign.service.js';
import { AuthService } from './services/auth.service.js';
import { authMiddleware } from './core/authMiddleware.js';
import webhookRouter from './api/webhook.controller.js';
import dashboardRouter from './api/dashboard.controller.js';
import importRouter from './api/import.controller.js';
import authRouter from './api/auth.controller.js';
import whatsappRouter from './api/whatsapp.controller.js';
import { errorMiddleware } from './core/errors/errorMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Security Middleware with CSP for Facebook SDK
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
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://whatsnau.9nau.com', 'https://9nau.com', 'https://www.9nau.com'];

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api/', limiter);

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
app.use('/api/webhooks/whatsapp', webhookRouter); // Industry standard hierarchical route
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/dashboard/import', authMiddleware, importRouter);
app.use('/api/whatsapp', authMiddleware, whatsappRouter);

// Serve static files from the frontend
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Fallback for SPA routing - serve index.html for non-API requests
app.get(/^(?!\/api).*/, (req: Request, res: Response) => {
  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err) {
      // If index.html is missing, it might be dev mode without a build
      res.status(404).send('Frontend not found. Did you run npm run build in /frontend?');
    }
  });
});

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
