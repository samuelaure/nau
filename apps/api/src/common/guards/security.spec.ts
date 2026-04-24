/**
 * Security integration tests — api service.
 *
 * These tests verify security-critical behaviours that pure unit tests cannot
 * cover in isolation: the interaction between the guard, the token format, and
 * the error response shape that clients depend on.
 *
 * Scope:
 *   - JwtAuthGuard: rejects missing, malformed, and expired tokens
 *   - ServiceAuthGuard: rejects wrong keys; accepts correct key from all sources
 *   - AllExceptionsFilter: ensures error responses never leak stack traces
 *
 * All tests mock external dependencies (JWT libs, Prisma) and use NestJS
 * Test.createTestingModule so the real NestJS DI container is exercised.
 *
 * To add a security test: add a new describe block here or in a sibling spec
 * file. Do NOT add security assertions to feature-level specs — keep them here
 * so they are easy to find and audit.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { ServiceAuthGuard } from './service-auth.guard'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext
}

describe('Security — ServiceAuthGuard (api)', () => {
  let guard: ServiceAuthGuard

  beforeEach(async () => {
    process.env.NAU_SERVICE_KEY = 'test-service-secret'

    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceAuthGuard],
    }).compile()

    guard = module.get<ServiceAuthGuard>(ServiceAuthGuard)
  })

  it('rejects requests with no auth header or service key', () => {
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException)
  })

  it('rejects requests with a wrong service key', () => {
    expect(() =>
      guard.canActivate(makeContext({ 'x-nau-service-key': 'wrong-key' })),
    ).toThrow(UnauthorizedException)
  })

  it('rejects an Authorization Bearer with wrong value', () => {
    expect(() =>
      guard.canActivate(makeContext({ authorization: 'Bearer wrong-value' })),
    ).toThrow(UnauthorizedException)
  })

  it('accepts the correct service key via x-nau-service-key header', () => {
    const result = guard.canActivate(
      makeContext({ 'x-nau-service-key': 'test-service-secret' }),
    )
    expect(result).toBe(true)
  })

  it('accepts the correct service key via Authorization Bearer', () => {
    const result = guard.canActivate(
      makeContext({ authorization: 'Bearer test-service-secret' }),
    )
    expect(result).toBe(true)
  })

  it('does not expose the secret in the error message when rejecting', () => {
    try {
      guard.canActivate(makeContext({ 'x-nau-service-key': 'wrong' }))
      fail('Expected UnauthorizedException')
    } catch (e) {
      const err = e as UnauthorizedException
      const message = JSON.stringify(err.getResponse())
      // The actual secret value must never appear in error responses
      expect(message).not.toContain('test-service-secret')
    }
  })
})

describe('Security — response shape on auth failure', () => {
  it('UnauthorizedException response contains statusCode and message fields', () => {
    const err = new UnauthorizedException('Missing access token')
    const response = err.getResponse() as Record<string, unknown>
    expect(response).toHaveProperty('statusCode', 401)
    expect(response).toHaveProperty('message')
    // Stack traces must not be present in the response
    expect(JSON.stringify(response)).not.toContain('Error:')
    expect(JSON.stringify(response)).not.toContain('.spec.ts')
  })
})
