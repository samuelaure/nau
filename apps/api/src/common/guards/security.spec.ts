import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ServiceAuthGuard } from './service-auth.guard'

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext
}

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('test-auth-secret-32-chars-minimum!!'),
}

describe('Security — ServiceAuthGuard (api)', () => {
  let guard: ServiceAuthGuard

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceAuthGuard,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()

    guard = module.get<ServiceAuthGuard>(ServiceAuthGuard)
  })

  it('rejects requests with no Authorization header', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException)
  })

  it('rejects requests with a malformed Bearer token', async () => {
    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer not-a-valid-jwt' })),
    ).rejects.toThrow(UnauthorizedException)
  })

  it('rejects an Authorization Bearer with an expired/invalid token', async () => {
    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer invalid.jwt.token' })),
    ).rejects.toThrow(UnauthorizedException)
  })
})

describe('Security — response shape on auth failure', () => {
  it('UnauthorizedException response contains statusCode and message fields', () => {
    const err = new UnauthorizedException('Missing service token')
    const response = err.getResponse() as Record<string, unknown>
    expect(response).toHaveProperty('statusCode', 401)
    expect(response).toHaveProperty('message')
    expect(JSON.stringify(response)).not.toContain('Error:')
    expect(JSON.stringify(response)).not.toContain('.spec.ts')
  })
})
