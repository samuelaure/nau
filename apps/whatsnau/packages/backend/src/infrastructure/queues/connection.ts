import { Redis } from 'ioredis';
import { config } from '../../core/config.js';
import { logger } from '../../core/logger.js';

const redisConfig = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Critical for BullMQ
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

export const connection = new Redis(redisConfig);

// Error handling
connection.on('error', async (err: Error) => {
  logger.error({ err }, 'Redis connection error');

  // Send alert (async, don't block)
  try {
    const { NotificationService } = await import('../../services/notification.service.js');
    await NotificationService.notifyInfrastructureFailure('REDIS_ERROR', err);
  } catch (alertErr) {
    logger.error({ err: alertErr }, 'Failed to send Redis error alert');
  }
});

connection.on('close', async () => {
  logger.warn('Redis connection closed, attempting reconnect');

  // Send alert (async, don't block)
  try {
    const { NotificationService } = await import('../../services/notification.service.js');
    await NotificationService.notifyInfrastructureFailure('REDIS_CLOSED', {});
  } catch (alertErr) {
    logger.error({ err: alertErr }, 'Failed to send Redis close alert');
  }
});

connection.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

connection.on('connect', () => {
  logger.info('Redis connected successfully');

  // Register cleanup handler (dynamic import to avoid circular dependency)
  import('../../core/resilience/GracefulShutdown.js')
    .then(({ GracefulShutdown }) => {
      GracefulShutdown.registerCleanupHandler('redis', async () => {
        await connection.quit();
      });
    })
    .catch((err) => logger.error({ err }, 'Failed to register Redis cleanup handler'));
});

/**
 * Check Redis health
 * Returns true if Redis is reachable
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await connection.ping();
    return true;
  } catch {
    return false;
  }
}
