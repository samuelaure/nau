import { vi } from 'vitest'

/**
 * Global test setup — runs before every test file.
 *
 * Provides shared mocks that suppress noise in all tests.
 * Per-test mocks (prisma, AI providers) are still declared locally
 * in each test file so the scope is explicit.
 */

// Suppress pino log output in tests — keeps test output clean
vi.mock('@/modules/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  },
  logError: vi.fn(),
}))
