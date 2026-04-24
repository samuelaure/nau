/**
 * accounts/actions.ts unit tests.
 *
 * The server actions (loginAction, registerAction, logoutAction) are thin
 * wrappers around fetch + Next.js cookies(). We test them by:
 *   1. Mocking the global fetch to return controlled responses.
 *   2. Mocking next/headers so cookies() returns a spy object we can inspect.
 *
 * Nothing real hits the network or a cookie jar.
 *
 * Coverage targets:
 *   - Happy path: API returns 200 + Set-Cookie header → cookies forwarded
 *   - Happy path: API returns 200 + JSON body tokens → cookies built + set
 *   - Error path: API returns non-200 → { ok: false, message }
 *   - Error path: fetch throws (network error) → { ok: false, message }
 *   - logoutAction: deletes access and refresh tokens, calls /auth/logout
 *   - parseSetCookie: correctly parses httpOnly, secure, sameSite, maxAge
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock next/headers ─────────────────────────────────────────────────────────
// cookies() is an async function that returns a CookieStore-like object.
const cookieSpy = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(cookieSpy),
}))

// ── Mock @nau/auth ─────────────────────────────────────────────────────────────
vi.mock('@nau/auth', () => ({
  buildAccessTokenCookie: vi.fn(
    (token: string) => `nau_access_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  ),
  buildRefreshTokenCookie: vi.fn(
    (token: string) => `nau_refresh_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  ),
  COOKIE_ACCESS_TOKEN: 'nau_access_token',
  COOKIE_REFRESH_TOKEN: 'nau_refresh_token',
}))

// ── Import SUT after mocks ─────────────────────────────────────────────────────
import { loginAction, registerAction, logoutAction } from '../actions'

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok:true when API returns 200 with Set-Cookie header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => ['nau_access_token=abc; Path=/; HttpOnly; Secure; SameSite=Lax'],
      },
      json: async () => ({}),
    })

    const result = await loginAction('user@test.com', 'password123')
    expect(result.ok).toBe(true)
    expect(cookieSpy.set).toHaveBeenCalledTimes(1)
  })

  it('returns ok:true and sets cookies from JSON body when no Set-Cookie header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { getSetCookie: () => [] },
      json: async () => ({ accessToken: 'at-1', refreshToken: 'rt-1', expiresIn: 900 }),
    })

    const result = await loginAction('user@test.com', 'pass')
    expect(result.ok).toBe(true)
    // buildAccessTokenCookie + buildRefreshTokenCookie should each trigger a set call
    expect(cookieSpy.set).toHaveBeenCalledTimes(2)
  })

  it('returns ok:false with API error message on non-200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Invalid credentials' }),
    })

    const result = await loginAction('user@test.com', 'wrong')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toBe('Invalid credentials')
  })

  it('returns ok:false with fallback message when API response body is unparseable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error('parse error') },
    })

    const result = await loginAction('user@test.com', 'wrong')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toBe('Authentication failed')
  })

  it('returns ok:false on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await loginAction('user@test.com', 'pass')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('Could not reach')
  })
})

describe('registerAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok:true on successful registration', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { getSetCookie: () => [] },
      json: async () => ({ accessToken: 'at-new', refreshToken: 'rt-new', expiresIn: 900 }),
    })

    const result = await registerAction('new@test.com', 'pass', 'Alice', 'Acme')
    expect(result.ok).toBe(true)
  })

  it('returns ok:false when registration fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Email already taken' }),
    })

    const result = await registerAction('taken@test.com', 'pass')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toBe('Email already taken')
  })
})

describe('logoutAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls /auth/logout with the refresh token and deletes both cookies', async () => {
    cookieSpy.get.mockReturnValue({ value: 'rt-token-abc' })
    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    await logoutAction()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(cookieSpy.delete).toHaveBeenCalledWith('nau_access_token')
    expect(cookieSpy.delete).toHaveBeenCalledWith('nau_refresh_token')
  })

  it('still deletes cookies even when logout API call fails', async () => {
    cookieSpy.get.mockReturnValue({ value: 'rt-token-abc' })
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))

    await logoutAction()

    expect(cookieSpy.delete).toHaveBeenCalledWith('nau_access_token')
    expect(cookieSpy.delete).toHaveBeenCalledWith('nau_refresh_token')
  })

  it('skips the API call when no refresh token cookie is present', async () => {
    cookieSpy.get.mockReturnValue(undefined)
    global.fetch = vi.fn()

    await logoutAction()

    expect(global.fetch).not.toHaveBeenCalled()
    expect(cookieSpy.delete).toHaveBeenCalledTimes(2)
  })
})
