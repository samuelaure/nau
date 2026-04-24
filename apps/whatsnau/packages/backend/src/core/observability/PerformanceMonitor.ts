import { db } from '../db.js';
import { logger } from '../logger.js';

/**
 * PerformanceMonitor - Track operation performance metrics
 *
 * Wraps operations to measure duration and success rate
 * Logs metrics to database for analysis
 */
export class PerformanceMonitor {
  /**
   * Track an async operation's performance
   * Measures duration and success/failure
   */
  static async track<T>(operation: string, fn: () => Promise<T>, tenantId?: string): Promise<T> {
    const start = Date.now();
    let success = true;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - start;

      // Log to database asynchronously (don't block)
      if (db.performanceMetric) {
        db.performanceMetric
          .create({
            data: { operation, duration, success, tenantId },
          })
          .catch((err) => logger.error({ err }, 'Failed to log performance metric'));
      }

      // Log to console
      logger.info({ operation, duration, success, tenantId }, 'Performance metric');
    }
  }
}
