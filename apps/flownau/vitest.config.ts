import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    alias: {
      '@': resolve(__dirname, './src'),
    },
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/modules/**/*.ts', 'src/app/api/**/*.ts'],
      exclude: [
        'src/modules/video/remotion/**',
        'src/modules/rendering/**',
        'src/modules/scenes/**',
        '**/*.test.ts',
        '**/__tests__/**',
        '**/*.config.*',
      ],
      thresholds: {
        lines: 4,
        functions: 4,
        branches: 4,
        statements: 4,
      },
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
