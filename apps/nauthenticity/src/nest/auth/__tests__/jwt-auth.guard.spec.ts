/**
 * JwtAuthGuard unit tests.
 *
 * Strategy: Build an ExecutionContext mock that returns a fake request object,
 * then assert the guard allows or rejects based on the token present.
 * The @nau/auth helpers (verifyAccessToken, extractBearerToken) are mocked so
 * this test does not depend on a real JWT secret or real token structure.
 */
import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtAuthGuard } from '../jwt-auth.guard'
import * as nauAuth from '@nau/auth'

jest.mock('@nau/auth', () => ({
  verifyAccessToken: jest.fn(),
  extractBearerToken: jest.fn(),
  AuthError: class AuthError extends Error {},
  COOKIE_ACCESS_TOKEN: 'nau_access_token',
}))

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
} as unknown as ConfigService

function makeContext(options: {
  cookie?: string
  authHeader?: string
}): any {
  const req: Record<string, unknown> = {
    cookies: options.cookie ? { nau_access_token: options.cookie } : {},
    headers: options.authHeader ? { authorization: options.authHeader } : {},
  }
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  }
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard

  beforeEach(() => {
    jest.clearAllMocks()
    guard = new JwtAuthGuard(mockConfigService)
  })

  it('rejects when no token is present in cookies or header', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue(undefined)
    const ctx = makeContext({})
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('accepts a valid cookie token and sets req.user', async () => {
    const payload = { sub: 'user-1', workspaceId: 'ws-1' }
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue(undefined)
    ;(nauAuth.verifyAccessToken as jest.Mock).mockResolvedValue(payload)

    const ctx = makeContext({ cookie: 'valid-token' })
    const result = await guard.canActivate(ctx)

    expect(result).toBe(true)
    expect(ctx.switchToHttp().getRequest().user).toEqual(payload)
  })

  it('accepts a valid Bearer token from Authorization header', async () => {
    const payload = { sub: 'user-2', workspaceId: 'ws-2' }
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('header-token')
    ;(nauAuth.verifyAccessToken as jest.Mock).mockResolvedValue(payload)

    const ctx = makeContext({ authHeader: 'Bearer header-token' })
    const result = await guard.canActivate(ctx)

    expect(result).toBe(true)
  })

  it('prefers cookie token over Authorization header when both present', async () => {
    const payload = { sub: 'user-3' }
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('header-token')
    ;(nauAuth.verifyAccessToken as jest.Mock).mockResolvedValue(payload)

    const ctx = makeContext({ cookie: 'cookie-token', authHeader: 'Bearer header-token' })
    await guard.canActivate(ctx)

    // verifyAccessToken should have been called with the cookie token (first arg)
    expect(nauAuth.verifyAccessToken).toHaveBeenCalledWith('cookie-token', 'test-secret')
  })

  it('throws UnauthorizedException when verifyAccessToken raises AuthError', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('bad-token')
    const authErr = new nauAuth.AuthError('Token expired')
    ;(nauAuth.verifyAccessToken as jest.Mock).mockRejectedValue(authErr)

    const ctx = makeContext({ authHeader: 'Bearer bad-token' })
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException for any unexpected error from verifyAccessToken', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('bad-token')
    ;(nauAuth.verifyAccessToken as jest.Mock).mockRejectedValue(new Error('network error'))

    const ctx = makeContext({ authHeader: 'Bearer bad-token' })
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })
})
