import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

/**
 * GlobalConfigService - High-level access to tenant-specific global configurations
 */
export class GlobalConfigService {
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Get config for a tenant
   */
  static async getConfig(tenantId: string) {
    // 1. Check cache
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // 2. Fetch from DB
    try {
      let config = await db.globalConfig.findUnique({
        where: { tenantId },
      });

      // 3. Fallback to singleton/default if not found
      if (!config) {
        config = await db.globalConfig.findFirst({
          where: { tenantId: 'default' }, // Hypothetical default tenant
        });
      }

      if (!config) {
        // Return default values if nothing in DB
        const defaults = {
          ownerName: 'Samuel',
          recoveryTimeoutMinutes: 240,
          maxUnansweredMessages: 2,
          defaultDemoDurationMinutes: 10,
          telegramAlertsEnabled: true,
          alertCooldownMinutes: 15,
        };
        return defaults;
      }

      // 4. Update cache
      this.cache.set(tenantId, { data: config, timestamp: Date.now() });
      return config;
    } catch (error) {
      logger.error({ err: error, tenantId }, 'Failed to fetch global config');
      // Return hardcoded defaults as last resort
      return {
        ownerName: 'Samuel',
        recoveryTimeoutMinutes: 240,
        maxUnansweredMessages: 2,
        defaultDemoDurationMinutes: 10,
        telegramAlertsEnabled: true,
        alertCooldownMinutes: 15,
      };
    }
  }

  /**
   * Clear cache for a tenant (e.g. after update)
   */
  static clearCache(tenantId: string) {
    this.cache.delete(tenantId);
  }
}
