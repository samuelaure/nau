import { vi } from 'vitest';

// Global mocks for infrastructure
vi.mock('./infrastructure/queues/connection.js', () => ({
  connection: {
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
    ping: vi.fn().mockResolvedValue('PONG'),
  },
  checkRedisHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('./infrastructure/queues/maintenance.queue.js', () => ({
  maintenanceQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job' }),
  },
  initRepeatableJobs: vi.fn(),
}));

// Mock DB health check to avoid real DB connection in unit tests
vi.mock('./core/db.js', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  };
});
