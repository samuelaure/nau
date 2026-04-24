/**
 * accounts — Login page E2E tests.
 *
 * These tests run against the accounts app at localhost:3002 (unauthenticated).
 * They verify the critical user-facing login flow end-to-end:
 *   - The login form renders correctly
 *   - Submitting bad credentials shows an error (API must be running)
 *   - The register link is present and navigates correctly
 *
 * Note: The happy-path "login succeeds → redirect" is covered by auth.setup.ts.
 * That setup file is the authoritative test that login works, and it runs before
 * all authenticated test projects.
 */
import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('renders the sign-in form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email address/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('shows an error message when credentials are invalid', async ({ page }) => {
    await page.getByLabel(/email address/i).fill('notreal@test.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    // API returns a 401, the form shows the error message from the server
    await expect(page.getByText(/invalid credentials|authentication failed/i)).toBeVisible({
      timeout: 8_000,
    })

    // URL should NOT have changed — we stay on the login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows a network error when the API is unreachable', async ({ page }) => {
    // Block all requests to the API to simulate a network failure
    await page.route('**/auth/login', (route) => route.abort('failed'))

    await page.getByLabel(/email address/i).fill('user@test.com')
    await page.getByLabel(/password/i).fill('password')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/network error|could not reach/i)).toBeVisible({ timeout: 8_000 })
  })

  test('navigates to the register page via the create account link', async ({ page }) => {
    await page.getByRole('link', { name: /create one/i }).click()
    await expect(page).toHaveURL(/\/register/)
  })
})
