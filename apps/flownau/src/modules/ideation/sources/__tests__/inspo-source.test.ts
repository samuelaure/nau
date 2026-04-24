import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { fetchBrandDigest } from '../inspo-source'
import { logger } from '@/modules/shared/logger'

vi.mock('axios')
vi.mock('@/modules/shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
}))
vi.mock('@nau/auth', () => ({
  signServiceToken: vi.fn().mockResolvedValue('mock-service-token'),
}))

describe('fetchBrandDigest()', () => {
  const brandId = 'brand-test-123'
  const mockUrl = 'http://nauthenticity-test'
  const mockDigest = {
    content: 'A rich creative direction text about authenticity and storytelling.',
    attachedUrls: ['https://instagram.com/p/abc123', 'https://instagram.com/p/def456'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NAUTHENTICITY_URL', mockUrl)
    vi.stubEnv('AUTH_SECRET', 'test-auth-secret-32-chars-minimum!!')
  })

  it('returns null if NAUTHENTICITY_URL is missing', async () => {
    vi.stubEnv('NAUTHENTICITY_URL', '')
    const result = await fetchBrandDigest(brandId)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('NAUTHENTICITY_URL not configured'))
  })

  it('returns null if AUTH_SECRET is missing', async () => {
    vi.stubEnv('AUTH_SECRET', '')
    const result = await fetchBrandDigest(brandId)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('AUTH_SECRET not configured'))
  })

  it('returns a BrandDigest on successful axios call', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: mockDigest })
    const result = await fetchBrandDigest(brandId)
    expect(result).toEqual(mockDigest)
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining(`/brands/${brandId}/inspo/digest`),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer mock-service-token' }) }),
    )
  })

  it('calls the correct nauthenticity URL', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: mockDigest })
    await fetchBrandDigest(brandId)
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining(mockUrl), expect.anything())
  })

  it('returns null and warns on ECONNREFUSED', async () => {
    const error = { code: 'ECONNREFUSED', isAxiosError: true }
    vi.mocked(axios.get).mockRejectedValue(error)
    vi.mocked(axios.isAxiosError).mockReturnValue(true)
    const result = await fetchBrandDigest(brandId)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('nauthenticity unreachable'))
  })

  it('returns null and warns on timeout (ECONNABORTED)', async () => {
    const error = { code: 'ECONNABORTED', isAxiosError: true }
    vi.mocked(axios.get).mockRejectedValue(error)
    vi.mocked(axios.isAxiosError).mockReturnValue(true)
    const result = await fetchBrandDigest(brandId)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('nauthenticity unreachable'))
  })

  it('returns null when response has unexpected shape (missing content)', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { attachedUrls: [] } })
    const result = await fetchBrandDigest(brandId)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unexpected digest response shape'))
  })

  it('handles digest with empty attachedUrls', async () => {
    const emptyUrlsDigest = { content: 'Some creative direction.', attachedUrls: [] }
    vi.mocked(axios.get).mockResolvedValue({ data: emptyUrlsDigest })
    const result = await fetchBrandDigest(brandId)
    expect(result).toEqual(emptyUrlsDigest)
  })
})
