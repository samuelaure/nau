/**
 * Vitest configuration for zazu-bot.
 *
 * Environment: node — this is a pure Node.js Express/Telegraf service.
 * Tests cover SkillManager dispatch logic and the service-auth middleware.
 * No real Telegram connection or database is required; dependencies are mocked
 * inline using vi.mock / vi.fn().
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
})
