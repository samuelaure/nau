import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { fetchPendingSourceConcepts, generateSourceConcepts, markSourceConceptConsumed } from '../inspo-source'
import { logger } from '@/modules/shared/logger'

vi.mock('axios')
vi.mock('@/modules/shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
}))
vi.mock('@nau/auth', () => ({
  signServiceToken: vi.fn().mockResolvedValue('mock-service-token'),
}))

const brandId = 'brand-test-123'
const mockUrl = 'http://nauthenticity-test'
const mockConcepts = [
  { id: 'c1', brandId, content: 'A rich angle about storytelling', sourceType: 'inspo_base', status: 'pending', createdAt: new Date().toISOString() },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NAUTHENTICITY_URL', mockUrl)
  vi.stubEnv('AUTH_SECRET', 'test-auth-secret-32-chars-minimum!!')
})

describe('fetchPendingSourceConcepts()', () => {
  it('returns empty array if NAUTHENTICITY_URL is missing', async () => {
    vi.stubEnv('NAUTHENTICITY_URL', '')
    const result = await fetchPendingSourceConcepts(brandId)
    expect(result).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('NAUTHENTICITY_URL or AUTH_SECRET not configured'))
  })

  it('returns concepts on success', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: mockConcepts })
    const result = await fetchPendingSourceConcepts(brandId)
    expect(result).toEqual(mockConcepts)
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining(`/brands/${brandId}/source-concepts`),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer mock-service-token' }) }),
    )
  })

  it('returns empty array on ECONNREFUSED', async () => {
    const error = { code: 'ECONNREFUSED', isAxiosError: true }
    vi.mocked(axios.get).mockRejectedValue(error)
    vi.mocked(axios.isAxiosError).mockReturnValue(true)
    const result = await fetchPendingSourceConcepts(brandId)
    expect(result).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('nauthenticity unreachable'))
  })
})

describe('generateSourceConcepts()', () => {
  it('calls the generate endpoint and returns concepts', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: mockConcepts })
    const result = await generateSourceConcepts(brandId)
    expect(result).toEqual(mockConcepts)
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining(`/brands/${brandId}/source-concepts/generate`),
      {},
      expect.anything(),
    )
  })

  it('returns empty array on network error', async () => {
    vi.mocked(axios.post).mockRejectedValue({ code: 'ECONNREFUSED', isAxiosError: true })
    vi.mocked(axios.isAxiosError).mockReturnValue(true)
    const result = await generateSourceConcepts(brandId)
    expect(result).toEqual([])
  })
})

describe('markSourceConceptConsumed()', () => {
  it('calls the consume endpoint', async () => {
    vi.mocked(axios.patch).mockResolvedValue({ data: {} })
    await markSourceConceptConsumed('c1')
    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/source-concepts/c1/consume'),
      {},
      expect.anything(),
    )
  })
})
