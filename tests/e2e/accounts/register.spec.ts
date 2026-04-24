/**
 * accounts — Register page E2E tests.
 *
 * Verifies the registration form renders and validates correctly.
 * We do NOT test a successful registration because it would create real database
 * records on each CI run. That scenario is covered by integration tests in the
 * api app (auth.controller.spec.ts).
 */
import { test, expect } from '@playwright/test'

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
  })

  test('renders the registration form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /create.*account|join|sign up|register/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('shows an error when trying to register with an already-taken email', async ({ page }) => {
    // Block the API and return a "taken" error
    await page.route('**/auth/register', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email already taken' }),
      }),
    )

    await page.getByLabel(/email/i).fill('taken@test.com')
    await page.getByLabel(/password/i).fill('Password1!')
    await page.getByRole('button', { name: /create|register|sign up/i }).click()

    await expect(page.getByText(/already taken|already exists/i)).toBeVisible({ timeout: 8_000 })
  })

  test('has a back link to the login page', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /sign in|log in|already have/i })
    await expect(loginLink).toBeVisible()
  })
})
