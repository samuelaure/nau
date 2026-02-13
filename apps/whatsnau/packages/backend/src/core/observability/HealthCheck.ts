import { checkDatabaseHealth } from '../db.js';
import { checkRedisHealth } from '../../infrastructure/queues/connection.js';
import { config } from '../config.js';

interface HealthStatus {
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptime: number;
  dependencies: {
    database: boolean;
    redis: boolean;
    openai: boolean;
    whatsapp: boolean;
  };
}

/**
 * HealthCheck - System health monitoring
 *
 * Checks all critical dependencies and returns overall health status
 */
export class HealthCheck {
  /**
   * Get comprehensive system health status
   */
  static async getSystemHealth(): Promise<HealthStatus> {
    // Run all checks in parallel
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOpenAI(),
      this.checkWhatsApp(),
    ]);

    const dependencies = {
      database: checks[0].status === 'fulfilled' ? checks[0].value : false,
      redis: checks[1].status === 'fulfilled' ? checks[1].value : false,
      openai: checks[2].status === 'fulfilled' ? checks[2].value : false,
      whatsapp: checks[3].status === 'fulfilled' ? checks[3].value : false,
    };

    // System is healthy only if all dependencies are healthy
    const allHealthy = Object.values(dependencies).every((v) => v === true);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies,
    };
  }

  /**
   * Check database connectivity
   */
  private static async checkDatabase(): Promise<boolean> {
    return checkDatabaseHealth();
  }

  /**
   * Check Redis connectivity
   */
  private static async checkRedis(): Promise<boolean> {
    return checkRedisHealth();
  }

  /**
   * Check OpenAI status
   * Now tenant-scoped, so we consider it healthy by default at system level.
   * Actual availability depends on individual tenant configuration.
   */
  private static async checkOpenAI(): Promise<boolean> {
    return true;
  }

  /**
   * Check WhatsApp status
   * Now tenant-scoped, so we consider it healthy by default at system level.
   */
  private static async checkWhatsApp(): Promise<boolean> {
    return true;
  }
}
