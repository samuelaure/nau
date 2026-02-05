import { describe, it, expect, vi } from 'vitest';
import { withErrorBoundary } from '../../core/resilience/ErrorBoundary.js';
import { db } from '../../core/db.js';

// Mock logger
vi.mock('../../core/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock DB
vi.mock('../../core/db.js', () => ({
  db: {
    systemAlert: {
      create: vi.fn(),
    },
  },
}));

describe('Chaos: OpenAI Rate Limit Resilience', () => {
  it('should degrade gracefully on 429 Rate Limit and emit alert', async () => {
    // 1. Simulate Rate Limit Failure
    const simulateRateLimit = async () => {
      const error = new Error('429 Too Many Requests');
      (error as any).status = 429;
      (error as any).code = 'rate_limit_exceeded';
      throw error;
    };

    // 2. Wrap in boundary
    const result = await withErrorBoundary(simulateRateLimit, {
      category: 'CHAOS_AI_TEST',
      severity: 'WARN', // Rate limits might be WARN not CRITICAL initially
      tenantId: 'chaos-tenant',
    });

    // 3. Assert Graceful Degradation
    expect(result).toBeNull();

    // 4. Assert Alert Persistence
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(db.systemAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        severity: 'WARN',
        category: 'CHAOS_AI_TEST',
        message: '429 Too Many Requests',
      }),
    });
  });
});
