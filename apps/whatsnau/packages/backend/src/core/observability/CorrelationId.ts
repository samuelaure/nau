import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * AsyncLocalStorage for correlation ID
 * Allows accessing correlation ID from anywhere in the call stack
 */
const correlationIdStorage = new AsyncLocalStorage<string>();

/**
 * Express middleware to inject correlation ID
 * Generates new ID if not present in request headers
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Get correlation ID from header or generate new one
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();

  // Set response header
  res.setHeader('x-correlation-id', correlationId);

  // Run the rest of the request in the correlation ID context
  correlationIdStorage.run(correlationId, () => {
    next();
  });
};

/**
 * Get current correlation ID from AsyncLocalStorage
 * Returns undefined if not in a request context
 */
export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore();
}
