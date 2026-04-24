/**
 * Vitest configuration for the accounts app.
 *
 * Environment: node — server actions run in Node.js context, not a browser.
 * We deliberately do NOT use jsdom here because the server actions use
 * Next.js server-only APIs (cookies()) which are mocked via vi.mock, and
 * don't need a DOM.
 *
 * For any future React component tests, add a separate config or use
 * environmentMatchGlobs to target specific test files with jsdom.
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/app/globals.css',
        'src/app/layout.tsx', // layout has no testable logic
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
