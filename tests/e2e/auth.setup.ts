/**
 * Auth setup for Playwright E2E tests.
 *
 * This file is run ONCE before any test project that declares a dependency on
 * "auth-setup". It performs a real login against the accounts app and saves the
 * authenticated browser state (cookies + localStorage) to disk.
 *
 * Subsequent tests load this state via `storageState` in playwright.config.ts
 * so they start already logged in — no need to re-run the login flow in every
 * test, which is slow and flaky.
 *
 * Credentials come from environment variables so they are never committed:
 *   E2E_USER_EMAIL     — email of a test user pre-seeded in the test database
 *   E2E_USER_PASSWORD  — password for that user
 *
 * Local development:
 *   Create a .env.test.local at the repo root (gitignored) with those two vars.
 *   The test user should be created by the API seed script (pnpm --filter=api test:db:seed).
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD env vars must be set to run authenticated E2E tests. ' +
        'See tests/e2e/auth.setup.ts for setup instructions.',
    )
  }

  // Navigate to the login page with a local redirect so the post-login redirect
  // stays within the test environment rather than going to the production app URL.
  const appBase = process.env.PLAYWRIGHT_BASE_URL_APP ?? 'http://localhost:3001'
  await page.goto(`/login?redirect_uri=${encodeURIComponent(appBase + '/home')}`)

  // Fill in credentials
  await page.getByLabel(/email address/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait for redirect to app — the login action sets cookies then redirects
  // to the app URL. We wait for the URL to change away from /login.
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 })

  // Save the browser state (cookies) for reuse
  await page.context().storageState({ path: AUTH_FILE })
})
