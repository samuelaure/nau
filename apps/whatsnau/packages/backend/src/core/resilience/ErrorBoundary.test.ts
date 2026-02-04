import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../db.js';
import { setCorrelationId, clearCorrelationId } from '../observability/CorrelationId.js';
import { withErrorBoundary } from '../resilience/ErrorBoundary.js';

// Mock dependencies
vi.mock('../db.js', () => ({
  db: {
    systemAlert: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../services/notification.service.js', () => ({
  NotificationService: {
    notifySystemError: vi.fn(),
  },
}));

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCorrelationId('test-correlation-id');
  });

  afterEach(() => {
    clearCorrelationId();
  });

  describe('Successful Operations', () => {
    it('should return result on successful operation', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not create SystemAlert on success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      expect(db.systemAlert.create).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return null on error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      const result = await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      expect(result).toBeNull();
    });

    it('should create SystemAlert on error', async () => {
      const error = new Error('Test error');
      const operation = vi.fn().mockRejectedValue(error);

      await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
        metadata: { foo: 'bar' },
        tenantId: 'tenant-123',
      });

      // Wait for async SystemAlert creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(db.systemAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'WARN',
          category: 'TEST_OPERATION',
          message: 'Test error',
          tenantId: 'tenant-123',
          context: expect.objectContaining({
            foo: 'bar',
            correlationId: 'test-correlation-id',
            stack: expect.stringContaining('Error: Test error'),
          }),
        }),
      });
    });

    it('should include correlation ID in SystemAlert', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(db.systemAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          context: expect.objectContaining({
            correlationId: 'test-correlation-id',
          }),
        }),
      });
    });
  });

  describe('Critical Error Notifications', () => {
    it('should send notification for CRITICAL errors', async () => {
      const { NotificationService } = await import('../../services/notification.service.js');
      const operation = vi.fn().mockRejectedValue(new Error('Critical error'));

      await withErrorBoundary(operation, {
        category: 'CRITICAL_OPERATION',
        severity: 'CRITICAL',
        metadata: { userId: 'user-123' },
        tenantId: 'tenant-123',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(NotificationService.notifySystemError).toHaveBeenCalledWith('CRITICAL', {
        category: 'CRITICAL_OPERATION',
        error: expect.any(Error),
        message: 'Critical error',
        tenantId: 'tenant-123',
        metadata: { userId: 'user-123' },
      });
    });

    it('should NOT send notification for WARN errors', async () => {
      const { NotificationService } = await import('../../services/notification.service.js');
      const operation = vi.fn().mockRejectedValue(new Error('Warning error'));

      await withErrorBoundary(operation, {
        category: 'WARN_OPERATION',
        severity: 'WARN',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(NotificationService.notifySystemError).not.toHaveBeenCalled();
    });
  });

  describe('Nested Failures', () => {
    it('should handle SystemAlert creation failure gracefully', async () => {
      vi.mocked(db.systemAlert.create).mockRejectedValue(new Error('DB error'));
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      const result = await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      // Should still return null despite SystemAlert failure
      expect(result).toBeNull();
    });

    it('should handle notification failure gracefully', async () => {
      const { NotificationService } = await import('../../services/notification.service.js');
      vi.mocked(NotificationService.notifySystemError).mockRejectedValue(
        new Error('Notification error')
      );

      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      const result = await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'CRITICAL',
      });

      // Should still return null despite notification failure
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle operation returning null', async () => {
      const operation = vi.fn().mockResolvedValue(null);

      const result = await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      expect(result).toBeNull();
      expect(db.systemAlert.create).not.toHaveBeenCalled();
    });

    it('should handle operation returning undefined', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      const result = await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      expect(result).toBeUndefined();
      expect(db.systemAlert.create).not.toHaveBeenCalled();
    });

    it('should handle missing correlation ID', async () => {
      clearCorrelationId();

      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(db.systemAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          context: expect.objectContaining({
            correlationId: undefined,
          }),
        }),
      });
    });

    it('should handle errors without stack trace', async () => {
      const errorWithoutStack = new Error('No stack');
      delete errorWithoutStack.stack;

      const operation = vi.fn().mockRejectedValue(errorWithoutStack);

      const result = await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      expect(result).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(db.systemAlert.create).toHaveBeenCalled();
    });

    it('should handle non-Error objects thrown', async () => {
      const operation = vi.fn().mockRejectedValue('String error');

      const result = await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      expect(result).toBeNull();
    });
  });

  describe('Metadata Handling', () => {
    it('should include all metadata in SystemAlert', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
        metadata: {
          userId: 'user-123',
          action: 'test-action',
          timestamp: Date.now(),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(db.systemAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          context: expect.objectContaining({
            userId: 'user-123',
            action: 'test-action',
            timestamp: expect.any(Number),
          }),
        }),
      });
    });

    it('should handle empty metadata', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      await withErrorBoundary(operation, {
        category: 'TEST_OPERATION',
        severity: 'WARN',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(db.systemAlert.create).toHaveBeenCalled();
    });
  });
});
