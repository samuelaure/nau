import { logger } from '../logger.js';
import { getCorrelationId } from '../observability/CorrelationId.js';
import { db } from '../db.js';
import { sanitizeForTelegram } from '../../services/sanitization.util.js';

interface ErrorBoundaryContext {
  category: string;
  severity: 'WARN' | 'CRITICAL';
  metadata?: any;
  tenantId?: string;
  rethrow?: boolean;
}

/**
 * ErrorBoundary - Centralized error handling wrapper
 *
 * Responsibilities:
 * - Wrap async operations in try-catch
 * - Log errors with correlation ID and context (Sanitized)
 * - Emit SystemAlert to database
 * - Send Telegram notifications for CRITICAL errors
 * - Handle rethrowing for worker retry logic
 * - Return null on error for graceful degradation (when rethrow=false)
 */

/**
 * Wrap an async operation with error boundary
 * Returns null on error instead of throwing (unless rethrow is true)
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  context: ErrorBoundaryContext
): Promise<T | null> {
  const sanitizedMetadata = context.metadata ? sanitizeForTelegram(context.metadata) : undefined;

  try {
    return await operation();
  } catch (error: any) {
    const correlationId = getCorrelationId();

    // Log error with sanitized context
    logger.error(
      {
        err: error,
        correlationId,
        operationName: context.category,
        severity: context.severity,
        metadata: sanitizedMetadata,
        tenantId: context.tenantId,
      },
      `Error boundary caught: ${context.category}`
    );

    // Emit SystemAlert to database (async, don't block)
    emitSystemAlert(context, error, correlationId, sanitizedMetadata).catch((err) => {
      logger.error({ err }, 'Failed to emit SystemAlert');
    });

    // Send notification for CRITICAL errors
    if (context.severity === 'CRITICAL') {
      sendCriticalAlert(context, error, sanitizedMetadata).catch((err) => {
        logger.error({ err }, 'Failed to send critical alert');
      });
    }

    // Rethrow if requested (e.g., for BullMQ workers to trigger retries)
    if (context.rethrow) {
      throw error;
    }

    // Return null for graceful degradation
    return null;
  }
}

/**
 * Emit SystemAlert to database
 */
async function emitSystemAlert(
  context: ErrorBoundaryContext,
  error: Error,
  correlationId?: string,
  sanitizedMetadata?: any
): Promise<void> {
  try {
    await db.systemAlert.create({
      data: {
        severity: context.severity,
        category: context.category,
        message: error.message,
        context: {
          ...sanitizedMetadata,
          correlationId,
          stack: error.stack,
        },
        tenantId: context.tenantId,
      },
    });
  } catch (err) {
    // Don't throw - this is a best-effort operation
    logger.error({ err }, 'Failed to create SystemAlert');
  }
}

/**
 * Send critical alert via notification service
 */
async function sendCriticalAlert(
  context: ErrorBoundaryContext,
  error: Error,
  sanitizedMetadata?: any
): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { NotificationService } = await import('../../services/notification.service.js');

    await NotificationService.notifySystemError(context.severity, {
      category: context.category,
      error,
      message: error.message,
      tenantId: context.tenantId,
      metadata: sanitizedMetadata,
    });
  } catch (err) {
    // Don't throw - this is a best-effort operation
    logger.error({ err }, 'Failed to send critical alert');
  }
}
