import { logger } from '../logger.js';
import { getCorrelationId } from '../observability/CorrelationId.js';
import { db } from '../db.js';

interface ErrorBoundaryContext {
  name: string;
  severity: 'WARN' | 'CRITICAL';
  metadata?: any;
  tenantId?: string;
}

/**
 * ErrorBoundary - Centralized error handling wrapper
 *
 * Responsibilities:
 * - Wrap async operations in try-catch
 * - Log errors with correlation ID and context
 * - Emit SystemAlert to database
 * - Send Telegram notifications for CRITICAL errors
 * - Return null on error for graceful degradation
 */

/**
 * Wrap an async operation with error boundary
 * Returns null on error instead of throwing (graceful degradation)
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  context: ErrorBoundaryContext
): Promise<T | null> {
  try {
    return await operation();
  } catch (error: any) {
    const correlationId = getCorrelationId();

    // Log error with full context
    logger.error(
      {
        err: error,
        correlationId,
        operationName: context.name,
        severity: context.severity,
        metadata: context.metadata,
        tenantId: context.tenantId,
      },
      `Error boundary caught: ${context.name}`
    );

    // Emit SystemAlert to database (async, don't block)
    emitSystemAlert(context, error, correlationId).catch((err) => {
      logger.error({ err }, 'Failed to emit SystemAlert');
    });

    // Send notification for CRITICAL errors
    if (context.severity === 'CRITICAL') {
      sendCriticalAlert(context, error).catch((err) => {
        logger.error({ err }, 'Failed to send critical alert');
      });
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
  correlationId?: string
): Promise<void> {
  try {
    await db.systemAlert.create({
      data: {
        severity: context.severity,
        category: context.name,
        message: error.message,
        context: {
          ...context.metadata,
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
async function sendCriticalAlert(context: ErrorBoundaryContext, error: Error): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { NotificationService } = await import('../../services/notification.service.js');

    await NotificationService.notifySystemError(context.severity, {
      category: context.name,
      error,
      message: error.message,
      tenantId: context.tenantId,
      metadata: context.metadata,
    });
  } catch (err) {
    // Don't throw - this is a best-effort operation
    logger.error({ err }, 'Failed to send critical alert');
  }
}
