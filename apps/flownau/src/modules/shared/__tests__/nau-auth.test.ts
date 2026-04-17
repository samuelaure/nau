import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateCronSecret, validateServiceKey } from '../nau-auth'

describe('nau-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'super-secret-cron')
    vi.stubEnv('NAU_SERVICE_KEY', 'super-secret-service')
  })

  describe('validateCronSecret()', () => {
    it('returns true for valid Bearer token', () => {
      const req = new Request('http://localhost', {
        headers: { authorization: 'Bearer super-secret-cron' },
      })
      expect(validateCronSecret(req)).toBe(true)
    })

    it('returns false for mismatched token', () => {
      const req = new Request('http://localhost', {
        headers: { authorization: 'Bearer wrong-secret' },
      })
      expect(validateCronSecret(req)).toBe(false)
    })

    it('returns false for missing Authorization header', () => {
      const req = new Request('http://localhost')
      expect(validateCronSecret(req)).toBe(false)
    })

    it('returns false for non-Bearer Authorization', () => {
      const req = new Request('http://localhost', {
        headers: { authorization: 'Basic secure' },
      })
      expect(validateCronSecret(req)).toBe(false)
    })
  })

  describe('validateServiceKey()', () => {
    it('returns true for valid x-service-key header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-service-key': 'super-secret-service' },
      })
      expect(validateServiceKey(req)).toBe(true)
    })

    it('returns false for missing header', () => {
      const req = new Request('http://localhost')
      expect(validateServiceKey(req)).toBe(false)
    })
  })
})
