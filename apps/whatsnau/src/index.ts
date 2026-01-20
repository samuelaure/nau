import { logger } from './core/logger.js';
import { db } from './core/db.js';

async function bootstrap() {
    logger.info('🚀 whatsnaŭ is starting...');

    try {
        // Basic connectivity check
        await db.$connect();
        logger.info('✅ Database connected successfully');

        logger.info('🛠 Platform initialized in Campaign-First mode');
    } catch (error) {
        logger.error({ err: error }, '❌ Failed to initialize platform');
        process.exit(1);
    }
}

bootstrap();
