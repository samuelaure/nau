import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

/**
 * Connect to database with retry logic
 * Retries up to maxRetries times with exponential backoff
 */
export async function connectWithRetry(maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await db.$connect();
      logger.info('✅ Database connected successfully');

      // Register cleanup handler (dynamic import to avoid circular dependency)
      import('./resilience/GracefulShutdown.js')
        .then(({ GracefulShutdown }) => {
          GracefulShutdown.registerCleanupHandler('database', async () => {
            await db.$disconnect();
          });
        })
        .catch((err) => logger.error({ err }, 'Failed to register database cleanup handler'));

      return;
    } catch (error) {
      logger.error({ err: error, attempt }, 'Database connection failed');

      if (attempt === maxRetries) {
        // Send alert before throwing
        try {
          const { NotificationService } = await import('../services/notification.service.js');
          await NotificationService.notifyInfrastructureFailure('DATABASE', error);
        } catch (err) {
          logger.error({ err }, 'Failed to send database failure alert');
        }

        throw error;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/**
 * Check database health
 * Returns true if database is reachable
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
