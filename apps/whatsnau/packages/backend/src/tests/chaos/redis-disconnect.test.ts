import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../core/db.js';
import { withErrorBoundary } from '../../core/resilience/ErrorBoundary.js';

// Mock logger
vi.mock('../../core/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    fatal: vi.fn(),
  },
}));

// Mock DB
vi.mock('../../core/db.js', () => ({
  db: {
    systemAlert: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

describe('Chaos: Redis Disconnect Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should survive a simulated Redis connection failure and emit critical alert', async () => {
    // 1. Simulate a critical failure
    const simulateFailure = async () => {
      const error = new Error('connect ETIMEDOUT');
      (error as any).code = 'ETIMEDOUT';
      throw error;
    };

    // 2. Wrap in boundary
    const result = await withErrorBoundary(simulateFailure, {
      category: 'CHAOS_REDIS_TEST',
      severity: 'CRITICAL',
      tenantId: 'chaos-tenant',
      metadata: { component: 'Worker' }, // Metadata
    });

    // 3. Assert Graceful Degradation
    expect(result).toBeNull();

    // 4. Assert Alert Persistence via Mock
    // ErrorBoundary calls `db.systemAlert.create` without awaiting it?
    // Wait, ErrorBoundary.ts:50: emitSystemAlert(...).catch(...)
    // It is fire-and-forget.
    // So we need to wait a tick? Or verify verify that it was called.

    // We can use a small delay or vi.waitFor (if available) or just flush promises.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(db.systemAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        severity: 'CRITICAL',
        category: 'CHAOS_REDIS_TEST',
        tenantId: 'chaos-tenant',
        message: 'connect ETIMEDOUT',
      }),
    });
  });
});
