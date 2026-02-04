import { Server } from 'http';
import { logger } from '../logger.js';

type CleanupHandler = () => Promise<void>;

/**
 * GracefulShutdown - Manages process lifecycle and coordinated shutdown
 */
export class GracefulShutdown {
  private static cleanupHandlers: Map<string, CleanupHandler> = new Map();
  private static isShuttingDown = false;
  private static readonly SHUTDOWN_TIMEOUT_MS = 30000;
  private static httpServer: Server | null = null;

  /**
   * Initialize process event handlers
   */
  static initialize(): void {
    process.on('SIGTERM', () => this.initiate('SIGTERM'));
    process.on('SIGINT', () => this.initiate('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.fatal({ err: error }, 'Uncaught exception');
      return this.initiate('UNCAUGHT_EXCEPTION', error);
    });

    process.on('unhandledRejection', (reason) => {
      logger.fatal({ reason }, 'Unhandled rejection');
      return this.initiate('UNHANDLED_REJECTION', new Error(String(reason)));
    });

    logger.info('GracefulShutdown initialized');
  }

  /**
   * Register HTTP server for graceful closure
   */
  static registerServer(server: Server): void {
    this.httpServer = server;
    logger.debug('HTTP Server registered for graceful shutdown');
  }

  /**
   * Register a cleanup handler
   */
  static registerCleanupHandler(name: string, handler: CleanupHandler): void {
    this.cleanupHandlers.set(name, handler);
    logger.debug({ name }, 'Cleanup handler registered');
  }

  /**
   * Initiate graceful shutdown
   */
  static async initiate(reason: string, error?: Error): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info({ reason, error: error?.message }, '🛑 Initiating graceful shutdown');

    const forceExitTimeout = setTimeout(() => {
      logger.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, this.SHUTDOWN_TIMEOUT_MS);

    try {
      // 1. Send alerts
      await this.sendShutdownAlert(reason, error);

      // 2. Close HTTP server (stop accepting new connections)
      if (this.httpServer) {
        logger.info('Closing HTTP server...');
        await new Promise<void>((resolve) => {
          this.httpServer?.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      // 3. Run cleanup handlers (LIFO)
      const handlers = Array.from(this.cleanupHandlers.entries()).reverse();
      for (const [name, handler] of handlers) {
        try {
          logger.info({ name }, 'Running cleanup handler');
          await handler();
        } catch (err) {
          logger.error({ err, name }, 'Cleanup handler failed');
        }
      }

      logger.info('Graceful shutdown completed');
      clearTimeout(forceExitTimeout);
      process.exit(error ? 1 : 0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  }

  private static async sendShutdownAlert(reason: string, error?: Error): Promise<void> {
    try {
      const { NotificationService } = await import('../../services/notification.service.js');
      await NotificationService.notifyFatalError(
        `SHUTDOWN_${reason}`,
        error || new Error(`Graceful shutdown initiated: ${reason}`)
      );
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (err) {
      logger.error({ err }, 'Failed to send shutdown alert');
    }
  }
}
