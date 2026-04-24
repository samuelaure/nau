/**
 * Playwright E2E configuration — nau-platform monorepo.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ARCHITECTURE                                                            │
 * │                                                                         │
 * │ Tests are grouped into projects by app. Each project sets a baseURL     │
 * │ pointing to the locally running dev server for that app.               │
 * │                                                                         │
 * │ Auth state:                                                             │
 * │   - The setup project (auth.setup.ts) performs a real login and saves  │
 * │     the authenticated cookie/session to tests/e2e/.auth/user.json.     │
 * │   - All app tests that require auth declare storageState so Playwright │
 * │     reuses the saved session, skipping the login flow every test.      │
 * │                                                                         │
 * │ Running locally:                                                        │
 * │   pnpm e2e                  — run all E2E tests                        │
 * │   pnpm e2e --project=app    — run only the main app tests              │
 * │   pnpm e2e --ui             — open the Playwright UI                   │
 * │                                                                         │
 * │ Running in CI (ci-e2e.yml):                                            │
 * │   Services are started via docker-compose before tests run.            │
 * │   PLAYWRIGHT_BASE_URL_* env vars override the defaults below.          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
import { defineConfig, devices } from '@playwright/test'

const BASE_ACCOUNTS = process.env.PLAYWRIGHT_BASE_URL_ACCOUNTS ?? 'http://localhost:3002'
const BASE_APP = process.env.PLAYWRIGHT_BASE_URL_APP ?? 'http://localhost:3001'
const BASE_ZAZU_DASHBOARD = process.env.PLAYWRIGHT_BASE_URL_ZAZU_DASHBOARD ?? 'http://localhost:3003'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'html',

  use: {
    // Take a screenshot and record a video on failure so failures are easy to diagnose.
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    trace: 'on-first-retry',
  },

  projects: [
    // ── Auth setup (runs first, saves session) ──────────────────────────
    {
      name: 'auth-setup',
      testMatch: '**/auth.setup.ts',
      use: {
        baseURL: BASE_ACCOUNTS,
        ...devices['Desktop Chrome'],
      },
    },

    // ── accounts app ────────────────────────────────────────────────────
    // Does NOT depend on auth-setup because these tests verify the login
    // page itself (unauthenticated flows).
    {
      name: 'accounts',
      testMatch: 'accounts/**/*.spec.ts',
      use: {
        baseURL: BASE_ACCOUNTS,
        ...devices['Desktop Chrome'],
      },
    },

    // ── main app (authenticated) ────────────────────────────────────────
    {
      name: 'app',
      testMatch: 'app/**/*.spec.ts',
      dependencies: ['auth-setup'],
      use: {
        baseURL: BASE_APP,
        storageState: 'tests/e2e/.auth/user.json',
        ...devices['Desktop Chrome'],
      },
    },

    // ── zazu-dashboard ──────────────────────────────────────────────────
    {
      name: 'zazu-dashboard',
      testMatch: 'zazu-dashboard/**/*.spec.ts',
      use: {
        baseURL: BASE_ZAZU_DASHBOARD,
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
