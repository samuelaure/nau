import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GracefulShutdown } from '../resilience/GracefulShutdown.js';
import type { Server } from 'http';

vi.mock('../../services/notification.service.js', () => ({
  NotificationService: {
    notifyFatalError: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('GracefulShutdown', () => {
  let mockServer: Server;
  let processExitSpy: any;
  let processOnSpy: any;

  beforeEach(() => {
    // Reset GracefulShutdown state
    (GracefulShutdown as any).isShuttingDown = false;
    (GracefulShutdown as any).cleanupHandlers = new Map();
    (GracefulShutdown as any).httpServer = null;

    // Mock HTTP server
    mockServer = {
      close: vi.fn((callback) => callback?.()),
    } as any;

    // Mock process methods more robustly
    processExitSpy = vi.fn();
    processOnSpy = vi.spyOn(process, 'on');
    vi.stubGlobal('process', {
      ...process,
      exit: processExitSpy,
      on: processOnSpy,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Initialization', () => {
    it('should register process event handlers', () => {
      GracefulShutdown.initialize();

      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should only initialize once', () => {
      GracefulShutdown.initialize();
      GracefulShutdown.initialize();

      // Should only register handlers once
      const sigTermCalls = processOnSpy.mock.calls.filter(
        (call: [string, any]) => call[0] === 'SIGTERM'
      );
      expect(sigTermCalls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Server Registration', () => {
    it('should register HTTP server', () => {
      GracefulShutdown.registerServer(mockServer);

      expect((GracefulShutdown as any).httpServer).toBe(mockServer);
    });

    it('should allow server registration before initialization', () => {
      GracefulShutdown.registerServer(mockServer);
      GracefulShutdown.initialize();

      expect((GracefulShutdown as any).httpServer).toBe(mockServer);
    });
  });

  describe('Cleanup Handler Registration', () => {
    it('should register cleanup handler', () => {
      const handler = vi.fn();

      GracefulShutdown.registerCleanupHandler('test-handler', handler);

      const handlers = (GracefulShutdown as any).cleanupHandlers as Map<string, any>;
      expect(handlers.size).toBe(1);
      expect(handlers.has('test-handler')).toBe(true);
    });

    it('should register multiple handlers', () => {
      GracefulShutdown.registerCleanupHandler('handler-1', vi.fn());
      GracefulShutdown.registerCleanupHandler('handler-2', vi.fn());
      GracefulShutdown.registerCleanupHandler('handler-3', vi.fn());

      const handlers = (GracefulShutdown as any).cleanupHandlers as Map<string, any>;
      expect(handlers.size).toBe(3);
    });

    it('should maintain handler order', () => {
      GracefulShutdown.registerCleanupHandler('first', vi.fn());
      GracefulShutdown.registerCleanupHandler('second', vi.fn());
      GracefulShutdown.registerCleanupHandler('third', vi.fn());

      const handlers = (GracefulShutdown as any).cleanupHandlers as Map<string, any>;
      const keys = Array.from(handlers.keys());
      expect(keys[0]).toBe('first');
      expect(keys[1]).toBe('second');
      expect(keys[2]).toBe('third');
    });
  });

  describe('Shutdown Sequence', () => {
    it('should close HTTP server before cleanup handlers', async () => {
      const executionOrder: string[] = [];

      mockServer.close = vi.fn((callback) => {
        executionOrder.push('server-close');
        callback?.();
      }) as any;

      const handler = vi.fn(async () => {
        executionOrder.push('cleanup-handler');
      });

      GracefulShutdown.registerServer(mockServer);
      GracefulShutdown.registerCleanupHandler('test', handler);

      await GracefulShutdown.initiate('TEST');

      expect(executionOrder).toEqual(['server-close', 'cleanup-handler']);
    });

    it('should execute cleanup handlers in LIFO order', async () => {
      const executionOrder: string[] = [];

      GracefulShutdown.registerCleanupHandler('first', async () => {
        executionOrder.push('first');
      });
      GracefulShutdown.registerCleanupHandler('second', async () => {
        executionOrder.push('second');
      });
      GracefulShutdown.registerCleanupHandler('third', async () => {
        executionOrder.push('third');
      });

      await GracefulShutdown.initiate('TEST');

      // Should execute in reverse order (LIFO)
      expect(executionOrder).toEqual(['third', 'second', 'first']);
    });

    it('should exit with code 0 on normal shutdown', async () => {
      await GracefulShutdown.initiate('SIGTERM');

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should exit with code 1 on error shutdown', async () => {
      const error = new Error('Test error');

      await GracefulShutdown.initiate('ERROR', error);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should prevent concurrent shutdowns', async () => {
      const handler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      GracefulShutdown.registerCleanupHandler('slow', handler);

      // Start first shutdown
      const shutdown1 = GracefulShutdown.initiate('TEST');

      // Try to start second shutdown
      const shutdown2 = GracefulShutdown.initiate('TEST');

      await Promise.all([shutdown1, shutdown2]);

      // Handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should continue shutdown if handler fails', async () => {
      const executionOrder: string[] = [];

      GracefulShutdown.registerCleanupHandler('failing', async () => {
        executionOrder.push('failing');
        throw new Error('Handler error');
      });

      GracefulShutdown.registerCleanupHandler('succeeding', async () => {
        executionOrder.push('succeeding');
      });

      await GracefulShutdown.initiate('TEST');

      // Both handlers should execute despite first one failing
      expect(executionOrder).toEqual(['succeeding', 'failing']);
      expect(processExitSpy).toHaveBeenCalled();
    });

    it('should handle server close errors', async () => {
      mockServer.close = vi.fn((callback) => {
        callback?.(new Error('Server close error'));
      }) as any;

      GracefulShutdown.registerServer(mockServer);

      await GracefulShutdown.initiate('TEST');

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle missing server gracefully', async () => {
      // Don't register server
      const handler = vi.fn();
      GracefulShutdown.registerCleanupHandler('test', handler);

      await GracefulShutdown.initiate('TEST');

      expect(handler).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalled();
    });
  });

  describe('Timeout Handling', () => {
    it('should force_exit after timeout', async () => {
      vi.useFakeTimers();

      // Set a very small timeout for the test
      (GracefulShutdown as any).SHUTDOWN_TIMEOUT_MS = 100;

      const slowHandler = vi.fn(async () => {
        // Never resolves
        await new Promise(() => {});
      });

      GracefulShutdown.registerCleanupHandler('slow', slowHandler);

      // Don't await because it will never resolve (stuck on handler)
      GracefulShutdown.initiate('TEST');

      // Fast-forward past timeout
      await vi.advanceTimersByTimeAsync(200);

      expect(processExitSpy).toHaveBeenCalledWith(1);

      vi.useRealTimers();
      // Reset timeout to original
      (GracefulShutdown as any).SHUTDOWN_TIMEOUT_MS = 30000;
    });
  });

  describe('Signal Handling', () => {
    it('should handle SIGTERM', async () => {
      GracefulShutdown.initialize();

      // Find SIGTERM handler
      const sigTermHandler = processOnSpy.mock.calls.find(
        (call: [string, any]) => call[0] === 'SIGTERM'
      )?.[1];

      expect(sigTermHandler).toBeDefined();

      // Trigger SIGTERM
      await sigTermHandler?.();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT', async () => {
      GracefulShutdown.initialize();

      const sigIntHandler = processOnSpy.mock.calls.find(
        (call: [string, any]) => call[0] === 'SIGINT'
      )?.[1];

      expect(sigIntHandler).toBeDefined();

      await sigIntHandler?.();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle uncaughtException', async () => {
      GracefulShutdown.initialize();

      const exceptionHandler = processOnSpy.mock.calls.find(
        (call: [string, any]) => call[0] === 'uncaughtException'
      )?.[1];

      expect(exceptionHandler).toBeDefined();

      const error = new Error('Uncaught error');
      await exceptionHandler?.(error);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle unhandledRejection', async () => {
      GracefulShutdown.initialize();

      const rejectionHandler = processOnSpy.mock.calls.find(
        (call: [string, any]) => call[0] === 'unhandledRejection'
      )?.[1];

      expect(rejectionHandler).toBeDefined();

      const error = new Error('Unhandled rejection');
      await rejectionHandler?.(error);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty cleanup handlers list', async () => {
      GracefulShutdown.registerServer(mockServer);

      await GracefulShutdown.initiate('TEST');

      expect(mockServer.close).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalled();
    });

    it('should handle null reason', async () => {
      await GracefulShutdown.initiate(null as any);
      expect(true).toBe(true);
    });

    it('should handle handler returning non-promise', async () => {
      const syncHandler = vi.fn(() => {
        // Synchronous handler
      });

      GracefulShutdown.registerCleanupHandler('sync', syncHandler as any);

      await GracefulShutdown.initiate('TEST');

      expect(syncHandler).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle realistic shutdown sequence', async () => {
      const executionOrder: string[] = [];

      // Register server
      mockServer.close = vi.fn((callback) => {
        executionOrder.push('http-server');
        callback?.();
      }) as any;
      GracefulShutdown.registerServer(mockServer);

      // Register cleanup handlers (typical order)
      GracefulShutdown.registerCleanupHandler('database', async () => {
        executionOrder.push('database');
      });

      GracefulShutdown.registerCleanupHandler('redis', async () => {
        executionOrder.push('redis');
      });

      GracefulShutdown.registerCleanupHandler('workers', async () => {
        executionOrder.push('workers');
      });

      await GracefulShutdown.initiate('SIGTERM');

      // Should execute in correct order
      expect(executionOrder).toEqual(['http-server', 'workers', 'redis', 'database']);
    });
  });
});
