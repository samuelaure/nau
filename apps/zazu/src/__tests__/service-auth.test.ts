/**
 * service-auth middleware unit tests.
 *
 * requireServiceAuth is an Express middleware that:
 *   1. Extracts a Bearer token from the Authorization header
 *   2. Verifies it as a service JWT via @nau/auth
 *   3. Calls next() on success, sends 401 on failure
 *
 * buildServiceHeaders is a helper that signs an outbound service JWT.
 *
 * @nau/auth helpers are mocked — no real crypto runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'

vi.mock('@nau/auth', () => ({
  verifyServiceToken: vi.fn(),
  extractBearerToken: vi.fn(),
  signServiceToken: vi.fn(),
  AuthError: class AuthError extends Error {},
}))

import * as nauAuth from '@nau/auth'
import { requireServiceAuth, buildServiceHeaders } from '../lib/service-auth'

function makeReq(authHeader?: string): Request {
  return { headers: authHeader ? { authorization: authHeader } : {} } as Request
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } & Partial<Response> {
  const res = { json: vi.fn() } as any
  res.status = vi.fn().mockReturnValue(res)
  return res
}

describe('requireServiceAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls next() when token is valid', async () => {
    ;(nauAuth.extractBearerToken as ReturnType<typeof vi.fn>).mockReturnValue('valid-token')
    ;(nauAuth.verifyServiceToken as ReturnType<typeof vi.fn>).mockResolvedValue({ iss: 'api' })

    const next = vi.fn()
    await requireServiceAuth(makeReq('Bearer valid-token'), makeRes() as any, next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('returns 401 when Authorization header is missing', async () => {
    ;(nauAuth.extractBearerToken as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

    const res = makeRes()
    const next = vi.fn()
    await requireServiceAuth(makeReq(), res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 with AuthError message when token verification fails', async () => {
    ;(nauAuth.extractBearerToken as ReturnType<typeof vi.fn>).mockReturnValue('bad-token')
    ;(nauAuth.verifyServiceToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new nauAuth.AuthError('Token expired', 'EXPIRED'),
    )

    const res = makeRes()
    await requireServiceAuth(makeReq('Bearer bad-token'), res as any, vi.fn())

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' })
  })

  it('returns 401 with generic message on unexpected errors', async () => {
    ;(nauAuth.extractBearerToken as ReturnType<typeof vi.fn>).mockReturnValue('token')
    ;(nauAuth.verifyServiceToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'))

    const res = makeRes()
    await requireServiceAuth(makeReq('Bearer token'), res as any, vi.fn())

    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid service token' })
  })
})

describe('buildServiceHeaders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns Authorization and Content-Type headers', async () => {
    ;(nauAuth.signServiceToken as ReturnType<typeof vi.fn>).mockResolvedValue('signed-jwt')

    const headers = await buildServiceHeaders('nauthenticity')

    expect(headers).toEqual({
      Authorization: 'Bearer signed-jwt',
      'Content-Type': 'application/json',
    })
    expect(nauAuth.signServiceToken).toHaveBeenCalledWith(
      expect.objectContaining({ iss: 'zazu', aud: 'nauthenticity' }),
    )
  })
})
