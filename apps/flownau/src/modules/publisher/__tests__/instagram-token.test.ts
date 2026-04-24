import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

vi.mock('@/modules/shared/prisma', () => ({
  prisma: {
    socialAccount: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Note: logger is mocked globally via src/test-setup.ts

import axios from 'axios'
import { prisma } from '@/modules/shared/prisma'
import { refreshTokenIfNeeded, getLongLivedToken, checkAllTokens } from '../instagram-token'

// ─── Helpers ──────────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

const mockAxiosGet = axios.get as ReturnType<typeof vi.fn>
const mockPrismaUpdate = prisma.socialAccount.update as ReturnType<typeof vi.fn>
const mockPrismaFindMany = prisma.socialAccount.findMany as ReturnType<typeof vi.fn>

// ─── refreshTokenIfNeeded ─────────────────────────────────────────

describe('refreshTokenIfNeeded()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('FB_APP_ID', 'test-app-id')
    vi.stubEnv('FB_APP_SECRET', 'test-app-secret')
    vi.stubEnv('TOKEN_REFRESH_DAYS_BEFORE_EXPIRY', '7')
  })

  it('returns existing token when expiry is far in the future (> buffer days)', async () => {
    const account = {
      id: 'acc-1',
      accessToken: 'existing-token',
      tokenExpiresAt: daysFromNow(30),
    }

    const result = await refreshTokenIfNeeded(account)

    expect(result).toBe('existing-token')
    expect(mockAxiosGet).not.toHaveBeenCalled()
  })

  it('returns existing token when tokenExpiresAt is null (no expiry tracked)', async () => {
    const account = {
      id: 'acc-1',
      accessToken: 'existing-token',
      tokenExpiresAt: null,
    }

    const result = await refreshTokenIfNeeded(account)

    expect(result).toBe('existing-token')
    expect(mockAxiosGet).not.toHaveBeenCalled()
  })

  it('throws "already expired" error when token has passed its expiry date', async () => {
    const account = {
      id: 'acc-1',
      accessToken: 'expired-token',
      tokenExpiresAt: daysAgo(1),
    }

    await expect(refreshTokenIfNeeded(account)).rejects.toThrow(/already expired/)
  })

  it('calls Instagram API and updates DB when token expires within buffer days', async () => {
    const account = {
      id: 'acc-1',
      accessToken: 'expiring-token',
      tokenExpiresAt: daysFromNow(3), // Within 7-day buffer
    }

    mockAxiosGet.mockResolvedValue({
      data: {
        access_token: 'refreshed-token',
        expires_in: 5184000, // 60 days in seconds
      },
    })
    mockPrismaUpdate.mockResolvedValue({})

    const result = await refreshTokenIfNeeded(account)

    expect(result).toBe('refreshed-token')
    expect(mockAxiosGet).toHaveBeenCalledOnce()
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'acc-1' },
        data: expect.objectContaining({ accessToken: 'refreshed-token' }),
      }),
    )
  })

  it('throws "Token refresh failed" when Instagram API call throws', async () => {
    const account = {
      id: 'acc-1',
      accessToken: 'expiring-token',
      tokenExpiresAt: daysFromNow(3),
    }

    mockAxiosGet.mockRejectedValue(new Error('Network error'))

    await expect(refreshTokenIfNeeded(account)).rejects.toThrow(/Token refresh failed/)
  })
})

// ─── getLongLivedToken ────────────────────────────────────────────

describe('getLongLivedToken()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('FB_APP_ID', 'test-app-id')
    vi.stubEnv('FB_APP_SECRET', 'test-app-secret')
  })

  it('returns access_token string on successful API response', async () => {
    mockAxiosGet.mockResolvedValue({
      data: { access_token: 'long-lived-token-abc', token_type: 'bearer' },
    })

    const result = await getLongLivedToken('short-lived-token')

    expect(result).toBe('long-lived-token-abc')
  })

  it('throws with descriptive error when response contains no access_token', async () => {
    mockAxiosGet.mockResolvedValue({
      data: { error: 'Invalid token', error_type: 'OAuthException' },
    })

    await expect(getLongLivedToken('bad-short-token')).rejects.toThrow(
      /getLongLivedToken.*no access_token/,
    )
  })

  it('propagates axios error when API call fails', async () => {
    mockAxiosGet.mockRejectedValue(new Error('HTTP 400'))

    await expect(getLongLivedToken('short-lived-token')).rejects.toThrow('HTTP 400')
  })
})

// ─── checkAllTokens ───────────────────────────────────────────────

describe('checkAllTokens()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAxiosGet.mockResolvedValue({
      data: { access_token: 'refreshed', expires_in: 5184000 },
    })
    mockPrismaUpdate.mockResolvedValue({})
  })

  it('returns status "expired" for accounts with past expiry date', async () => {
    mockPrismaFindMany.mockResolvedValue([
      {
        id: 'acc-1',
        username: 'testuser',
        accessToken: 'some-token',
        tokenExpiresAt: daysAgo(5),
      },
    ])

    const results = await checkAllTokens()

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('expired')
    expect(results[0].accountId).toBe('acc-1')
  })

  it('returns status "valid" for accounts with far-future expiry', async () => {
    mockPrismaFindMany.mockResolvedValue([
      {
        id: 'acc-2',
        username: 'testuser2',
        accessToken: 'valid-token',
        tokenExpiresAt: daysFromNow(30),
      },
    ])

    const results = await checkAllTokens()

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('valid')
  })

  it('returns status "valid" when tokenExpiresAt is null', async () => {
    mockPrismaFindMany.mockResolvedValue([
      {
        id: 'acc-3',
        username: 'testuser3',
        accessToken: 'some-token',
        tokenExpiresAt: null,
      },
    ])

    const results = await checkAllTokens()

    expect(results[0].status).toBe('valid')
  })

  it('returns status "error" when token refresh throws during checkAllTokens', async () => {
    mockPrismaFindMany.mockResolvedValue([
      {
        id: 'acc-4',
        username: 'erroruser',
        accessToken: 'expiring-token',
        tokenExpiresAt: daysFromNow(3), // Within buffer
      },
    ])
    mockAxiosGet.mockRejectedValue(new Error('Instagram API down'))

    const results = await checkAllTokens()

    expect(results[0].status).toBe('error')
    expect(results[0].error).toMatch(/Token refresh failed/)
  })

  it('returns status "refreshed" when token refresh succeeds during checkAllTokens', async () => {
    mockPrismaFindMany.mockResolvedValue([
      {
        id: 'acc-5',
        username: 'refreshuser',
        accessToken: 'expiring-token',
        tokenExpiresAt: daysFromNow(3),
      },
    ])

    const results = await checkAllTokens()

    expect(results[0].status).toBe('refreshed')
  })
})
