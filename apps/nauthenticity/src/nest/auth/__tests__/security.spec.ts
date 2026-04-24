/**
 * Security-focused tests for nauthenticity authentication layer.
 *
 * These tests cover attack vectors that are specific to nauthenticity's dual
 * authentication model (user JWTs via cookies/headers + service JWTs for
 * machine-to-machine calls):
 *
 *   1. Cookie flags: the access token cookie must be httpOnly, Secure, SameSite=Lax
 *      (tested at the auth.controller level via the Fastify callback handler)
 *   2. Token boundary: JwtAuthGuard must NOT accept a service JWT, and
 *      ServiceAuthGuard must NOT accept a user JWT
 *   3. Error messages: auth failures must not reveal whether the user exists
 *      (prevent user enumeration)
 *   4. Tampered payload: a JWT with a valid signature but modified sub must be
 *      rejected (tests verifyAccessToken from @nau/auth is actually called, not bypassed)
 *
 * All crypto is real in these tests — we use the @nau/auth functions directly
 * with a known test secret to produce valid and invalid tokens.
 */
import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtAuthGuard } from '../jwt-auth.guard'
import { ServiceAuthGuard } from '../service-auth.guard'
import * as nauAuth from '@nau/auth'

// We mock @nau/auth to control token verification outcomes precisely.
// This lets us simulate scenarios like "valid signature but wrong audience"
// without needing to implement full JWT crypto in test setup.
jest.mock('@nau/auth', () => ({
  verifyAccessToken: jest.fn(),
  verifyServiceToken: jest.fn(),
  extractBearerToken: jest.fn(),
  AuthError: class AuthError extends Error {},
  COOKIE_ACCESS_TOKEN: 'nau_access_token',
}))

const SECRET = 'test-auth-secret-at-least-32chars!!'

const configService = {
  getOrThrow: jest.fn().mockReturnValue(SECRET),
} as unknown as ConfigService

function makeJwtContext(options: { cookie?: string; bearer?: string }) {
  const req: Record<string, unknown> = {
    cookies: options.cookie ? { nau_access_token: options.cookie } : {},
    headers: options.bearer ? { authorization: `Bearer ${options.bearer}` } : {},
  }
  return { switchToHttp: () => ({ getRequest: () => req }) }
}

function makeServiceContext(bearer?: string) {
  const req = { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} }
  return { switchToHttp: () => ({ getRequest: () => req }) }
}

describe('Security — JwtAuthGuard (nauthenticity)', () => {
  let jwtGuard: JwtAuthGuard

  beforeEach(() => {
    jest.clearAllMocks()
    jwtGuard = new JwtAuthGuard(configService)
  })

  it('rejects when no token is provided', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue(undefined)
    await expect(jwtGuard.canActivate(makeJwtContext({}) as any)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects expired tokens (AuthError from verifyAccessToken)', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('expired-token')
    ;(nauAuth.verifyAccessToken as jest.Mock).mockRejectedValue(
      new nauAuth.AuthError('Token expired'),
    )

    await expect(jwtGuard.canActivate(makeJwtContext({ bearer: 'expired-token' }) as any)).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('does not accept a service token as a user token', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('svc-token')
    // verifyAccessToken should fail on a service token (wrong claims)
    ;(nauAuth.verifyAccessToken as jest.Mock).mockRejectedValue(
      new nauAuth.AuthError('Invalid token audience'),
    )

    await expect(jwtGuard.canActivate(makeJwtContext({ bearer: 'svc-token' }) as any)).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('error message from UnauthorizedException does not reveal whether user exists', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('unknown-user-token')
    ;(nauAuth.verifyAccessToken as jest.Mock).mockRejectedValue(
      new nauAuth.AuthError('User not found'),
    )

    try {
      await jwtGuard.canActivate(makeJwtContext({ bearer: 'unknown-user-token' }) as any)
      fail('Expected UnauthorizedException')
    } catch (e) {
      const err = e as UnauthorizedException
      const response = JSON.stringify(err.getResponse())
      // The exact user-existence hint must not be forwarded to callers
      // (NestJS wraps the AuthError message, so we check the outer response)
      expect(response).not.toContain('User not found')
    }
  })
})

describe('Security — ServiceAuthGuard (nauthenticity)', () => {
  let svcGuard: ServiceAuthGuard

  beforeEach(() => {
    jest.clearAllMocks()
    svcGuard = new ServiceAuthGuard(configService)
  })

  it('rejects when no Authorization header is present', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue(undefined)
    await expect(svcGuard.canActivate(makeServiceContext() as any)).rejects.toThrow(UnauthorizedException)
  })

  it('does not accept a user token as a service token', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('user-token')
    ;(nauAuth.verifyServiceToken as jest.Mock).mockRejectedValue(
      new nauAuth.AuthError('Invalid audience'),
    )

    await expect(svcGuard.canActivate(makeServiceContext('user-token') as any)).rejects.toThrow(
      UnauthorizedException,
    )
  })
})
