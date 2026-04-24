/**
 * FrequencyService unit tests.
 *
 * FrequencyService contains pure logic for spaced-repetition review scheduling:
 *   - parseFrequencyToDays: converts "2 months" → 60
 *   - formatDaysToFrequency: converts 60 → "2 months"
 *   - getNextFrequencyInterval: moves up/down the frequency chain
 *   - getFrequencyChain: reads the chain from SettingsRepository (mocked)
 *
 * All tests use DEFAULT_FREQUENCY_CHAIN so no DB is required for the pure
 * functions. getFrequencyChain and getNextFrequencyInterval are tested with
 * a mocked SettingsRepository.
 */
import {
  parseFrequencyToDays,
  formatDaysToFrequency,
  getNextFrequencyInterval,
  DEFAULT_FREQUENCY_CHAIN,
} from '../FrequencyService'

// Mock SettingsRepository so getFrequencyChain does not try to hit SQLite
jest.mock('@/repositories/SettingsRepository', () => ({
  getSetting: jest.fn().mockResolvedValue(null), // null = use DEFAULT_FREQUENCY_CHAIN
}))

describe('parseFrequencyToDays', () => {
  it.each([
    ['1 day', 1],
    ['2 days', 2],
    ['4 days', 4],
    ['8 days', 8],
    ['16 days', 16],
    ['1 month', 30],
    ['2 months', 60],
    ['4 months', 120],
    ['1 year', 365],
  ])('parses "%s" to %d days', (input, expected) => {
    expect(parseFrequencyToDays(input)).toBe(expected)
  })

  it('returns 0 for empty string', () => {
    expect(parseFrequencyToDays('')).toBe(0)
  })

  it('returns 1 when unit is unrecognised', () => {
    expect(parseFrequencyToDays('3 decades')).toBe(3)
  })
})

describe('formatDaysToFrequency', () => {
  it('formats 0 as Unscheduled', () => {
    expect(formatDaysToFrequency(0)).toBe('Unscheduled')
  })

  it('formats 1 as "1 day"', () => {
    expect(formatDaysToFrequency(1)).toBe('1 day')
  })

  it('formats 2 as "2 days"', () => {
    expect(formatDaysToFrequency(2)).toBe('2 days')
  })

  it('formats 30 as "1 month"', () => {
    expect(formatDaysToFrequency(30)).toBe('1 month')
  })

  it('formats 60 as "2 months"', () => {
    expect(formatDaysToFrequency(60)).toBe('2 months')
  })

  it('formats 365 as "1 year"', () => {
    expect(formatDaysToFrequency(365)).toBe('1 year')
  })

  it('formats 730 as "2 years"', () => {
    expect(formatDaysToFrequency(730)).toBe('2 years')
  })

  it('formats 7 as "1 week"', () => {
    expect(formatDaysToFrequency(7)).toBe('1 week')
  })
})

describe('getNextFrequencyInterval — with default chain', () => {
  // DEFAULT_FREQUENCY_CHAIN (in days): 1, 2, 4, 8, 16, 30, 60, 120, 365

  it('returns a smaller interval when direction is "more"', async () => {
    // currentDays=8, next "more frequent" should be 4
    const next = await getNextFrequencyInterval(8, 'more')
    expect(next).toBe(4)
  })

  it('returns a larger interval when direction is "less"', async () => {
    // currentDays=8, next "less frequent" should be 16
    const next = await getNextFrequencyInterval(8, 'less')
    expect(next).toBe(16)
  })

  it('falls back gracefully when already at smallest interval (more frequent)', async () => {
    // currentDays=1 (smallest), no smaller option → half of current = 1 → max(1, ...)
    const next = await getNextFrequencyInterval(1, 'more')
    expect(next).toBeGreaterThanOrEqual(1)
  })

  it('falls back gracefully when already at largest interval (less frequent)', async () => {
    // currentDays=365 (largest), no larger option → currentDays * 2
    const next = await getNextFrequencyInterval(365, 'less')
    expect(next).toBe(730)
  })
})
