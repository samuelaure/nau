import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { logger } from './logger.js';

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ['error', 'warn'] });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export async function connectWithRetry(maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await db.$connect();
      logger.info('✅ Database connected successfully');

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
        try {
          const { NotificationService } = await import('../services/notification.service.js');
          await NotificationService.notifyInfrastructureFailure('DATABASE', error);
        } catch (err) {
          logger.error({ err }, 'Failed to send database failure alert');
        }

        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
