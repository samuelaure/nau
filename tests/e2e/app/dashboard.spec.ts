/**
 * app — Authenticated dashboard E2E tests.
 *
 * These tests depend on the "auth-setup" project (see playwright.config.ts).
 * They start with a pre-authenticated browser state — the login flow has already
 * been completed in auth.setup.ts and session cookies are restored.
 *
 * Smoke tests verify that:
 *   - The dashboard loads after authentication
 *   - The user is not redirected to /login (confirming auth cookies are valid)
 *   - Core UI elements are visible
 *
 * Add more granular tests here as features stabilise.
 */
import { test, expect } from '@playwright/test'

test.describe('Dashboard (authenticated)', () => {
  test('loads the dashboard without redirecting to login', async ({ page }) => {
    await page.goto('/')

    // If auth cookies are not set correctly, Next.js middleware would redirect to /login
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('shows the main navigation', async ({ page }) => {
    await page.goto('/')

    // The nav is always present when authenticated — exact selectors depend on
    // the app structure; update these if the layout changes
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible()
  })
})

test.describe('Session expiry', () => {
  test('redirects to accounts login when access cookie is cleared', async ({ page, context }) => {
    // Clear cookies to simulate an expired session
    await context.clearCookies()
    await page.goto('/')

    // Should redirect to the accounts SSO URL
    await page.waitForURL(/\/login|accounts\.9nau\.com/, { timeout: 8_000 })
  })
})
