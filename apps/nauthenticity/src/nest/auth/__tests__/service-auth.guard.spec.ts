/**
 * ServiceAuthGuard unit tests.
 *
 * ServiceAuthGuard validates inbound service-to-service JWTs (machine tokens).
 * Tests follow the same pattern as jwt-auth.guard.spec.ts — mock the @nau/auth
 * helpers, never call real crypto.
 */
import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ServiceAuthGuard } from '../service-auth.guard'
import * as nauAuth from '@nau/auth'

jest.mock('@nau/auth', () => ({
  verifyServiceToken: jest.fn(),
  extractBearerToken: jest.fn(),
  AuthError: class AuthError extends Error {},
}))

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
} as unknown as ConfigService

function makeContext(authHeader?: string): any {
  const req: Record<string, unknown> = {
    headers: authHeader ? { authorization: authHeader } : {},
  }
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  }
}

describe('ServiceAuthGuard', () => {
  let guard: ServiceAuthGuard

  beforeEach(() => {
    jest.clearAllMocks()
    guard = new ServiceAuthGuard(mockConfigService)
  })

  it('rejects when Authorization header is absent', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue(undefined)
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('accepts a valid service token and sets req.serviceClient', async () => {
    const payload = { iss: 'api', aud: 'nauthenticity' }
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('valid-svc-token')
    ;(nauAuth.verifyServiceToken as jest.Mock).mockResolvedValue(payload)

    const ctx = makeContext('Bearer valid-svc-token')
    const result = await guard.canActivate(ctx)

    expect(result).toBe(true)
    expect(ctx.switchToHttp().getRequest().serviceClient).toEqual(payload)
  })

  it('throws UnauthorizedException on AuthError', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('expired')
    ;(nauAuth.verifyServiceToken as jest.Mock).mockRejectedValue(
      new nauAuth.AuthError('Token expired'),
    )
    await expect(guard.canActivate(makeContext('Bearer expired'))).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('throws UnauthorizedException on unexpected errors', async () => {
    ;(nauAuth.extractBearerToken as jest.Mock).mockReturnValue('bad')
    ;(nauAuth.verifyServiceToken as jest.Mock).mockRejectedValue(new Error('db error'))
    await expect(guard.canActivate(makeContext('Bearer bad'))).rejects.toThrow(UnauthorizedException)
  })
})
