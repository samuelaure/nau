import { Redis } from 'ioredis';
import { config } from '../../core/config.js';
import { logger } from '../../core/logger.js';

const redisConfig = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Critical for BullMQ
};

export const connection = new Redis(redisConfig);

connection.on('error', (err: Error) => {
  logger.error({ err }, 'Redis connection error');
});

connection.on('connect', () => {
  logger.info('Redis connected successfully');
});
