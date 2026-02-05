import { initWorkers } from './infrastructure/workers/index.js';
import { connectWithRetry } from './core/db.js';
import { logger } from './core/logger.js';
import { GracefulShutdown } from './core/resilience/GracefulShutdown.js';
import { config } from './core/config.js';

async function bootstrap() {
  logger.info('🚀 Worker Service starting...');

  // Initialize Resilience
  GracefulShutdown.initialize();

  try {
    // 1. Database Connection
    await connectWithRetry();

    // 2. Initialize Workers
    initWorkers();

    logger.info('✅ Workers initialized and processing jobs');
  } catch (error) {
    logger.fatal({ err: error }, '❌ Fatal error during worker bootstrap');
    await GracefulShutdown.initiate('WORKER_BOOTSTRAP_FAILED', error as Error);
  }
}

bootstrap();
