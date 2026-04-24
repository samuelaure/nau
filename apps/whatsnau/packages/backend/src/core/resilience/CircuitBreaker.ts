import { logger } from '../logger.js';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  failureThreshold: number; // Number of consecutive failures before opening
  timeout: number; // Time in ms before transitioning to HALF_OPEN
}

/**
 * CircuitBreaker - Protects external service calls from cascading failures
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail fast
 * - HALF_OPEN: Testing if service recovered, single request allowed
 *
 * Transitions:
 * - CLOSED → OPEN: After failureThreshold consecutive failures
 * - OPEN → HALF_OPEN: After timeout period
 * - HALF_OPEN → CLOSED: If test request succeeds
 * - HALF_OPEN → OPEN: If test request fails
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: number;
  private readonly name: string;
  private readonly options: CircuitBreakerOptions;

  constructor(name: string, options: CircuitBreakerOptions) {
    this.name = name;
    this.options = options;
    logger.info({ name, options }, 'CircuitBreaker initialized');
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition to HALF_OPEN
    if (this.state === 'OPEN' && this.shouldAttemptReset()) {
      this.state = 'HALF_OPEN';
      logger.info({ name: this.name }, 'CircuitBreaker: OPEN → HALF_OPEN');
    }

    // Fail fast if circuit is OPEN
    if (this.state === 'OPEN') {
      const error = new Error(`CircuitBreaker ${this.name} is OPEN`);
      logger.warn({ name: this.name }, 'CircuitBreaker: Request rejected (circuit OPEN)');
      throw error;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset circuit to CLOSED state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    logger.info({ name: this.name }, 'CircuitBreaker: Manually reset to CLOSED');
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // Success in HALF_OPEN state → transition to CLOSED
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.lastFailureTime = undefined;
      logger.info({ name: this.name }, 'CircuitBreaker: HALF_OPEN → CLOSED (recovery confirmed)');
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.warn(
      { name: this.name, failureCount: this.failureCount, state: this.state },
      'CircuitBreaker: Failure recorded'
    );

    if (this.state === 'HALF_OPEN') {
      // Failure in HALF_OPEN → back to OPEN
      this.state = 'OPEN';
      logger.warn({ name: this.name }, 'CircuitBreaker: HALF_OPEN → OPEN (recovery failed)');
    } else if (this.state === 'CLOSED' && this.failureCount >= this.options.failureThreshold) {
      // Too many failures in CLOSED → transition to OPEN
      this.state = 'OPEN';
      logger.error(
        { name: this.name, failureCount: this.failureCount },
        'CircuitBreaker: CLOSED → OPEN (threshold exceeded)'
      );

      // Send alert (async, don't block)
      this.sendCircuitOpenAlert().catch((err) => {
        logger.error({ err }, 'Failed to send circuit open alert');
      });
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.options.timeout;
  }

  /**
   * Send alert when circuit opens
   */
  private async sendCircuitOpenAlert(): Promise<void> {
    try {
      const { NotificationService } = await import('../../services/notification.service.js');

      await NotificationService.notifySystemError('CRITICAL', {
        category: 'CIRCUIT_BREAKER_OPEN',
        message: `Circuit breaker ${this.name} is now OPEN`,
        error: new Error(`${this.name} circuit opened after ${this.failureCount} failures`),
        metadata: {
          circuitName: this.name,
          failureCount: this.failureCount,
          threshold: this.options.failureThreshold,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send circuit open alert');
    }
  }
}
