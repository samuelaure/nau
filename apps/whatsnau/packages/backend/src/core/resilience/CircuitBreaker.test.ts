import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../resilience/CircuitBreaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  let mockOperation: any;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      timeout: 5000, // Time before OPEN → HALF_OPEN
    });
    mockOperation = vi.fn();
  });

  describe('Closed State (Normal Operation)', () => {
    it('should execute operation successfully when closed', async () => {
      mockOperation.mockResolvedValue('success');

      const result = await breaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should track successful operations', async () => {
      mockOperation.mockResolvedValue('success');

      await breaker.execute(mockOperation);
      await breaker.execute(mockOperation);

      expect(breaker.getState()).toBe('CLOSED');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Failure Tracking', () => {
    it('should increment failure count on error', async () => {
      mockOperation.mockRejectedValue(new Error('Service error'));

      try {
        await breaker.execute(mockOperation);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after reaching failure threshold', async () => {
      mockOperation.mockRejectedValue(new Error('Service error'));

      // Trigger 3 failures (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');
    });

    it('should reset failure count after successful operation', async () => {
      mockOperation
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue('success');

      try {
        await breaker.execute(mockOperation);
      } catch (error) {
        // First call fails
      }

      await breaker.execute(mockOperation);

      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('Open State (Circuit Tripped)', () => {
    beforeEach(async () => {
      // Trip the circuit
      mockOperation.mockRejectedValue(new Error('Service error'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (error) {
          // Expected
        }
      }
    });

    it('should fail fast when circuit is open', async () => {
      mockOperation.mockResolvedValue('success');

      try {
        await breaker.execute(mockOperation);
        expect.fail('Should have thrown CircuitBreakerError');
      } catch (error: any) {
        expect(error.message).toContain('CircuitBreaker test-service is OPEN');
      }

      // Operation should not be called
      expect(mockOperation).toHaveBeenCalledTimes(3); // Only from beforeEach
    });

    it('should transition to half-open after timeout', async () => {
      vi.useFakeTimers();

      // Fast-forward past timeout
      vi.advanceTimersByTime(5000);

      // Next execute should check and transition to HALF_OPEN
      mockOperation.mockResolvedValue('success');
      await breaker.execute(mockOperation);

      // After successful test request, should be CLOSED
      expect(breaker.getState()).toBe('CLOSED');

      vi.useRealTimers();
    });
  });

  describe('Half-Open State (Testing Recovery)', () => {
    beforeEach(async () => {
      vi.useFakeTimers();

      // Trip the circuit
      mockOperation.mockRejectedValue(new Error('Service error'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (error) {
          // Expected
        }
      }

      // Move past timeout to allow HALF_OPEN transition
      vi.advanceTimersByTime(5000);
    });

    it('should close circuit on successful test request', async () => {
      mockOperation.mockResolvedValue('success');

      const result = await breaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('CLOSED');

      vi.useRealTimers();
    });

    it('should reopen circuit on failed test request', async () => {
      mockOperation.mockRejectedValue(new Error('Still failing'));

      try {
        await breaker.execute(mockOperation);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      expect(breaker.getState()).toBe('OPEN');

      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly threshold failures', async () => {
      mockOperation.mockRejectedValue(new Error('Error'));

      // Exactly 3 failures (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');
    });

    it('should handle null/undefined return values', async () => {
      mockOperation.mockResolvedValue(null);

      const result = await breaker.execute(mockOperation);

      expect(result).toBeNull();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should handle manual reset', async () => {
      mockOperation.mockRejectedValue(new Error('Error'));

      // Trip circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      // Manual reset
      breaker.reset();

      expect(breaker.getState()).toBe('CLOSED');

      // Should work again
      mockOperation.mockResolvedValue('success');
      const result = await breaker.execute(mockOperation);
      expect(result).toBe('success');
    });
  });
});
