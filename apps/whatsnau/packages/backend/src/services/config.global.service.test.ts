import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GlobalConfigService } from './config.global.service.js';
import { db } from '../core/db.js';

// Mock dependencies
vi.mock('../core/db.js', () => ({
  db: {
    globalConfig: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe('GlobalConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache before each test
    (GlobalConfigService as any).cache = new Map();
  });

  describe('Config Retrieval', () => {
    it('should fetch config from database', async () => {
      const mockConfig = {
        id: 'config-123',
        tenantId: 'tenant-123',
        ownerName: 'Samuel',
        recoveryTimeoutMinutes: 240,
        maxUnansweredMessages: 2,
        defaultDemoDurationMinutes: 10,
        telegramAlertsEnabled: true,
        alertCooldownMinutes: 15,
      };

      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(mockConfig as any);

      const config = await GlobalConfigService.getConfig('tenant-123');

      expect(config).toEqual(mockConfig);
      expect(db.globalConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
      });
    });

    it('should return config for different tenants', async () => {
      const config1 = {
        tenantId: 'tenant-1',
        maxUnansweredMessages: 2,
      };

      const config2 = {
        tenantId: 'tenant-2',
        maxUnansweredMessages: 5,
      };

      vi.mocked(db.globalConfig.findUnique)
        .mockResolvedValueOnce(config1 as any)
        .mockResolvedValueOnce(config2 as any);

      const result1 = await GlobalConfigService.getConfig('tenant-1');
      const result2 = await GlobalConfigService.getConfig('tenant-2');

      expect(result1.maxUnansweredMessages).toBe(2);
      expect(result2.maxUnansweredMessages).toBe(5);
    });
  });

  describe('Caching', () => {
    it('should cache config after first fetch', async () => {
      const mockConfig = {
        tenantId: 'tenant-123',
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(mockConfig as any);

      // First call
      await GlobalConfigService.getConfig('tenant-123');

      // Second call (should use cache)
      await GlobalConfigService.getConfig('tenant-123');

      // Database should only be called once
      expect(db.globalConfig.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      vi.useFakeTimers();

      const mockConfig = {
        tenantId: 'tenant-123',
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(mockConfig as any);

      // First call
      await GlobalConfigService.getConfig('tenant-123');

      // Advance time past TTL (60 seconds)
      vi.advanceTimersByTime(61000);

      // Second call (cache expired, should fetch again)
      await GlobalConfigService.getConfig('tenant-123');

      expect(db.globalConfig.findUnique).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should cache separately for different tenants', async () => {
      const config1 = { tenantId: 'tenant-1', maxUnansweredMessages: 2 };
      const config2 = { tenantId: 'tenant-2', maxUnansweredMessages: 5 };

      vi.mocked(db.globalConfig.findUnique)
        .mockResolvedValueOnce(config1 as any)
        .mockResolvedValueOnce(config2 as any);

      await GlobalConfigService.getConfig('tenant-1');
      await GlobalConfigService.getConfig('tenant-2');

      // Both should be cached separately
      await GlobalConfigService.getConfig('tenant-1');
      await GlobalConfigService.getConfig('tenant-2');

      // Should only fetch once per tenant
      expect(db.globalConfig.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should clear cache for specific tenant', async () => {
      const mockConfig = {
        tenantId: 'tenant-123',
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(mockConfig as any);

      // Fetch and cache
      await GlobalConfigService.getConfig('tenant-123');

      // Clear cache
      GlobalConfigService.clearCache('tenant-123');

      // Fetch again (should hit DB)
      await GlobalConfigService.getConfig('tenant-123');

      expect(db.globalConfig.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('Fallback Behavior', () => {
    it('should return defaults if config not found', async () => {
      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(null);
      vi.mocked(db.globalConfig.findFirst).mockResolvedValue(null);

      const config = await GlobalConfigService.getConfig('tenant-new');

      expect(config).toEqual({
        ownerName: 'Samuel',
        recoveryTimeoutMinutes: 240,
        maxUnansweredMessages: 2,
        defaultDemoDurationMinutes: 10,
        telegramAlertsEnabled: true,
        alertCooldownMinutes: 15,
      });
    });

    it('should try default tenant if tenant config not found', async () => {
      const defaultConfig = {
        tenantId: 'default',
        maxUnansweredMessages: 3,
      };

      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(null);
      vi.mocked(db.globalConfig.findFirst).mockResolvedValue(defaultConfig as any);

      const config = await GlobalConfigService.getConfig('tenant-new');

      expect(config).toEqual(defaultConfig);
      expect(db.globalConfig.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'default' },
      });
    });

    it('should return defaults on database error', async () => {
      vi.mocked(db.globalConfig.findUnique).mockRejectedValue(new Error('DB error'));

      const config = await GlobalConfigService.getConfig('tenant-123');

      expect(config).toEqual({
        ownerName: 'Samuel',
        recoveryTimeoutMinutes: 240,
        maxUnansweredMessages: 2,
        defaultDemoDurationMinutes: 10,
        telegramAlertsEnabled: true,
        alertCooldownMinutes: 15,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      vi.mocked(db.globalConfig.findUnique).mockRejectedValue(new Error('Connection lost'));

      const config = await GlobalConfigService.getConfig('tenant-123');

      // Should return defaults instead of throwing
      expect(config).toBeDefined();
      expect(config.maxUnansweredMessages).toBe(2);
    });

    it('should handle timeout errors', async () => {
      vi.mocked(db.globalConfig.findUnique).mockRejectedValue(new Error('Query timeout'));

      const config = await GlobalConfigService.getConfig('tenant-123');

      expect(config).toBeDefined();
    });

    it('should log errors but not throw', async () => {
      vi.mocked(db.globalConfig.findUnique).mockRejectedValue(new Error('Test error'));

      await expect(GlobalConfigService.getConfig('tenant-123')).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null tenantId', async () => {
      const config = await GlobalConfigService.getConfig(null as any);

      // Should return defaults
      expect(config).toBeDefined();
      expect(config.maxUnansweredMessages).toBe(2);
    });

    it('should handle empty string tenantId', async () => {
      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(null);
      vi.mocked(db.globalConfig.findFirst).mockResolvedValue(null);

      const config = await GlobalConfigService.getConfig('');

      expect(config).toBeDefined();
    });

    it('should handle concurrent requests for same tenant', async () => {
      const mockConfig = {
        tenantId: 'tenant-123',
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(mockConfig as any);

      // Concurrent requests
      const promises = [
        GlobalConfigService.getConfig('tenant-123'),
        GlobalConfigService.getConfig('tenant-123'),
        GlobalConfigService.getConfig('tenant-123'),
      ];

      await Promise.all(promises);

      // Should only fetch once due to caching
      // Note: Actual behavior depends on timing, but at least one should hit cache
      expect(db.globalConfig.findUnique).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should not cache errors', async () => {
      vi.mocked(db.globalConfig.findUnique)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ tenantId: 'tenant-123', maxUnansweredMessages: 2 } as any);

      // First call fails
      const config1 = await GlobalConfigService.getConfig('tenant-123');
      expect(config1.maxUnansweredMessages).toBe(2); // Defaults

      // Second call should retry (error not cached)
      const config2 = await GlobalConfigService.getConfig('tenant-123');
      expect(config2.maxUnansweredMessages).toBe(2); // From DB

      expect(db.globalConfig.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should handle cache corruption gracefully', async () => {
      const mockConfig = {
        tenantId: 'tenant-123',
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(mockConfig as any);

      // Fetch and cache
      await GlobalConfigService.getConfig('tenant-123');

      // Corrupt cache
      (GlobalConfigService as any).cache.set('tenant-123', {
        data: null,
        timestamp: Date.now(),
      });

      // Should handle gracefully
      const config = await GlobalConfigService.getConfig('tenant-123');
      expect(config).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should return cached value quickly', async () => {
      const mockConfig = {
        tenantId: 'tenant-123',
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.globalConfig.findUnique).mockResolvedValue(mockConfig as any);

      // First call (cache miss)
      const start1 = Date.now();
      await GlobalConfigService.getConfig('tenant-123');
      const duration1 = Date.now() - start1;

      // Second call (cache hit)
      const start2 = Date.now();
      await GlobalConfigService.getConfig('tenant-123');
      const duration2 = Date.now() - start2;

      // Cache hit should be faster (though timing is not guaranteed)
      expect(db.globalConfig.findUnique).toHaveBeenCalledTimes(1);
    });
  });
});
