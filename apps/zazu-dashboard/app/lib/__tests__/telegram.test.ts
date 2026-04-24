/**
 * Telegram init-data utilities unit tests.
 *
 * validateTelegramInitData uses HMAC-SHA256 to verify Telegram Web App init data.
 * This is a pure crypto function with no external dependencies — we can test it
 * by crafting valid and invalid HMAC signatures ourselves using Node's crypto module.
 *
 * parseTelegramUser extracts and JSON-parses the "user" field from the init data
 * query string.
 *
 * These tests guard against regressions in the Telegram auth flow, which is the
 * sole authentication mechanism for zazu-dashboard.
 */
import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { validateTelegramInitData, parseTelegramUser } from '../telegram'

/**
 * Builds a valid Telegram initData string with a correct HMAC hash.
 * Mirrors the algorithm Telegram uses server-side.
 */
function buildValidInitData(botToken: string, payload: Record<string, string>): string {
  const params = new URLSearchParams(payload)

  const dataCheckString = Array.from(params.keys())
    .sort()
    .map((k) => `${k}=${params.get(k)}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  params.set('hash', hash)
  return params.toString()
}

const BOT_TOKEN = 'test-bot-token-12345'

describe('validateTelegramInitData', () => {
  it('returns true for correctly signed initData', () => {
    const initData = buildValidInitData(BOT_TOKEN, {
      user: JSON.stringify({ id: 123, first_name: 'Alice' }),
      auth_date: '1700000000',
    })

    expect(validateTelegramInitData(initData, BOT_TOKEN)).toBe(true)
  })

  it('returns false when the hash has been tampered with', () => {
    const initData = buildValidInitData(BOT_TOKEN, {
      user: JSON.stringify({ id: 123 }),
      auth_date: '1700000000',
    })
    const tampered = initData.replace(/hash=[^&]+/, 'hash=aaaaaaaaaaaaaaaa')

    expect(validateTelegramInitData(tampered, BOT_TOKEN)).toBe(false)
  })

  it('returns false when signed with a different bot token', () => {
    const initData = buildValidInitData('wrong-token', {
      user: JSON.stringify({ id: 123 }),
      auth_date: '1700000000',
    })

    expect(validateTelegramInitData(initData, BOT_TOKEN)).toBe(false)
  })

  it('returns false when initData is an empty string', () => {
    expect(validateTelegramInitData('', BOT_TOKEN)).toBe(false)
  })

  it('returns false when botToken is an empty string', () => {
    const initData = buildValidInitData(BOT_TOKEN, { auth_date: '1700000000' })
    expect(validateTelegramInitData(initData, '')).toBe(false)
  })

  it('returns false when the hash field is missing', () => {
    // URLSearchParams without a hash field
    const initData = new URLSearchParams({ user: '{"id":1}', auth_date: '1700000000' }).toString()
    expect(validateTelegramInitData(initData, BOT_TOKEN)).toBe(false)
  })
})

describe('parseTelegramUser', () => {
  it('returns the parsed user object from initData', () => {
    const user = { id: 42, first_name: 'Bob', username: 'bob_tg' }
    const initData = new URLSearchParams({ user: JSON.stringify(user), auth_date: '1700000000' }).toString()

    expect(parseTelegramUser(initData)).toEqual(user)
  })

  it('returns null when user field is absent', () => {
    const initData = new URLSearchParams({ auth_date: '1700000000' }).toString()
    expect(parseTelegramUser(initData)).toBeNull()
  })

  it('returns null when user field contains invalid JSON', () => {
    const initData = new URLSearchParams({ user: '{invalid json}', auth_date: '1700000000' }).toString()
    expect(parseTelegramUser(initData)).toBeNull()
  })
})
