/**
 * Vitest configuration for zazu-dashboard.
 *
 * Environment: node — the core testable logic (Telegram HMAC validation,
 * session helpers) runs in Node.js context and uses the Node crypto module.
 * No jsdom required for these tests.
 *
 * If React component tests are added later, use environmentMatchGlobs to
 * target those files with the jsdom environment instead.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['app/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['app/**/*.{ts,tsx}'],
      exclude: ['app/**/*.d.ts'],
    },
  },
})
