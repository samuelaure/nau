/**
 * auth.ts unit tests (zazu-dashboard session helpers).
 *
 * getSession and validateSessionOrDie wrap validateTelegramInitData and
 * parseTelegramUser. Tests mock those helpers so auth.ts logic is isolated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../telegram', () => ({
  validateTelegramInitData: vi.fn(),
  parseTelegramUser: vi.fn(),
}))

import * as telegram from '../telegram'
import { getSession, validateSessionOrDie } from '../auth'

function makeHeaders(initData?: string): Headers {
  const headers = new Headers()
  if (initData) headers.set('x-telegram-init-data', initData)
  return headers
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TELEGRAM_BOT_TOKEN = 'test-token'
})

describe('getSession', () => {
  it('returns null when x-telegram-init-data header is missing', async () => {
    const result = await getSession(makeHeaders())
    expect(result).toBeNull()
  })

  it('returns null when TELEGRAM_BOT_TOKEN env is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    const result = await getSession(makeHeaders('some-data'))
    expect(result).toBeNull()
  })

  it('returns null when signature validation fails', async () => {
    ;(telegram.validateTelegramInitData as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const result = await getSession(makeHeaders('invalid-data'))
    expect(result).toBeNull()
  })

  it('returns a session with parsed user when validation passes', async () => {
    const user = { id: 1, first_name: 'Alice' }
    ;(telegram.validateTelegramInitData as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(telegram.parseTelegramUser as ReturnType<typeof vi.fn>).mockReturnValue(user)

    const result = await getSession(makeHeaders('valid-data'))
    expect(result).toEqual({ user })
  })
})

describe('validateSessionOrDie', () => {
  it('throws when session is null', async () => {
    ;(telegram.validateTelegramInitData as ReturnType<typeof vi.fn>).mockReturnValue(false)
    await expect(validateSessionOrDie(makeHeaders('bad-data'))).rejects.toThrow('Unauthorized')
  })

  it('returns session when valid', async () => {
    const user = { id: 2, first_name: 'Bob' }
    ;(telegram.validateTelegramInitData as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(telegram.parseTelegramUser as ReturnType<typeof vi.fn>).mockReturnValue(user)

    const session = await validateSessionOrDie(makeHeaders('valid'))
    expect(session.user).toEqual(user)
  })
})
