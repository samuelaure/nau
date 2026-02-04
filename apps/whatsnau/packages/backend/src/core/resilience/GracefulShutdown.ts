import { logger } from '../logger.js';

type CleanupHandler = () => Promise<void>;

/**
 * GracefulShutdown - Manages process lifecycle and coordinated shutdown
 *
 * Responsibilities:
 * - Register process event handlers (SIGTERM, SIGINT, uncaughtException, unhandledRejection)
 * - Coordinate shutdown sequence across all services
 * - Ensure cleanup handlers run in reverse registration order
 * - Timeout after 30 seconds to force exit
 * - Send alerts before shutdown
 */
export class GracefulShutdown {
  private static cleanupHandlers: Map<string, CleanupHandler> = new Map();
  private static isShuttingDown = false;
  private static readonly SHUTDOWN_TIMEOUT_MS = 30000; // 30 seconds

  /**
   * Initialize process event handlers
   * Call this once at application startup
   */
  static initialize(): void {
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received');
      await this.initiate('SIGTERM');
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received');
      await this.initiate('SIGINT');
    });

    process.on('uncaughtException', async (error: Error) => {
      logger.fatal({ err: error }, 'Uncaught exception');
      await this.initiate('UNCAUGHT_EXCEPTION', error);
    });

    process.on('unhandledRejection', async (reason: any) => {
      logger.fatal({ reason }, 'Unhandled rejection');
      await this.initiate('UNHANDLED_REJECTION', new Error(String(reason)));
    });

    logger.info('GracefulShutdown initialized');
  }

  /**
   * Register a cleanup handler
   * Handlers are executed in reverse registration order (LIFO)
   */
  static registerCleanupHandler(name: string, handler: CleanupHandler): void {
    if (this.cleanupHandlers.has(name)) {
      logger.warn({ name }, 'Cleanup handler already registered, overwriting');
    }
    this.cleanupHandlers.set(name, handler);
    logger.debug({ name }, 'Cleanup handler registered');
  }

  /**
   * Initiate graceful shutdown
   * Can be called manually or triggered by process events
   */
  static async initiate(reason: string, error?: Error): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info({ reason, error: error?.message }, '🛑 Initiating graceful shutdown');

    // Set timeout to force exit if cleanup takes too long
    const forceExitTimeout = setTimeout(() => {
      logger.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, this.SHUTDOWN_TIMEOUT_MS);

    try {
      // Send alert before shutdown (if notification service is available)
      await this.sendShutdownAlert(reason, error);

      // Run cleanup handlers in reverse order (LIFO)
      const handlers = Array.from(this.cleanupHandlers.entries()).reverse();

      for (const [name, handler] of handlers) {
        try {
          logger.info({ name }, 'Running cleanup handler');
          await handler();
          logger.info({ name }, 'Cleanup handler completed');
        } catch (err) {
          logger.error({ err, name }, 'Cleanup handler failed');
        }
      }

      logger.info('Graceful shutdown completed');
      clearTimeout(forceExitTimeout);
      process.exit(error ? 1 : 0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  }

  /**
   * Send shutdown alert via notification service
   * Wrapped in try-catch to avoid circular dependencies
   */
  private static async sendShutdownAlert(reason: string, error?: Error): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency
      const { NotificationService } = await import('../../services/notification.service.js');

      await NotificationService.notifyFatalError(
        `SHUTDOWN_${reason}`,
        error || new Error(`Graceful shutdown initiated: ${reason}`)
      );

      // Give time for alert to send
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (err) {
      logger.error({ err }, 'Failed to send shutdown alert');
    }
  }
}
