/**
 * ScrapingService unit tests.
 *
 * ScrapingService coordinates:
 *   1. Creating a ScrapingRun record in Prisma
 *   2. Firing a fire-and-forget HTTP call to the Apify API
 *   3. Ingesting returned posts via upsert
 *
 * All Prisma calls and the global `fetch` are mocked so no real DB or network
 * is needed. The fire-and-forget pattern (callApify) means we use
 * jest.useFakeTimers + process.nextTick to let the background promise settle.
 */
import { NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { mockDeep, DeepMockProxy } from 'jest-mock-extended'
import { ScrapingService } from '../scraping.service'
import { PrismaService } from '../../prisma/prisma.service'

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('apify-test-token'),
} as unknown as ConfigService

describe('ScrapingService', () => {
  let service: ScrapingService
  let prisma: DeepMockProxy<PrismaService>
  let fetchMock: jest.Mock

  beforeEach(() => {
    prisma = mockDeep<PrismaService>()
    service = new ScrapingService(prisma, mockConfigService)

    fetchMock = jest.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('startRun', () => {
    it('creates a ScrapingRun record with status=running', async () => {
      const runRecord = { id: 'run-1', brandId: 'brand-1', platform: 'INSTAGRAM', username: 'test', status: 'running' }
      prisma.scrapingRun.create.mockResolvedValue(runRecord as any)
      prisma.scrapingRun.update.mockResolvedValue({} as any)

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'apify-run-1', defaultDatasetId: 'ds-1' } }),
      })

      const result = await service.startRun({
        brandId: 'brand-1',
        targets: ['testuser'],
        platform: 'INSTAGRAM',
        limit: 10,
      } as any)

      expect(prisma.scrapingRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ brandId: 'brand-1', status: 'running' }),
        }),
      )
      expect(result.runs).toHaveLength(1)
      expect(result.runs[0].status).toBe('running')
    })

    it('defaults to INSTAGRAM platform when none specified', async () => {
      const runRecord = { id: 'run-2', brandId: 'brand-1', platform: 'INSTAGRAM', username: 'u', status: 'running' }
      prisma.scrapingRun.create.mockResolvedValue(runRecord as any)
      prisma.scrapingRun.update.mockResolvedValue({} as any)
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'ar', defaultDatasetId: 'ds' } }),
      })

      await service.startRun({ brandId: 'brand-1', targets: ['u'] } as any)

      expect(prisma.scrapingRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ platform: 'INSTAGRAM' }),
        }),
      )
    })
  })

  describe('ingestPosts', () => {
    it('upserts posts and marks run as completed', async () => {
      const run = { id: 'run-1', brandId: 'brand-1', platform: 'INSTAGRAM' }
      prisma.scrapingRun.findUnique.mockResolvedValue(run as any)
      prisma.post.upsert.mockResolvedValue({} as any)
      prisma.scrapingRun.update.mockResolvedValue({} as any)

      const result = await service.ingestPosts({
        runId: 'run-1',
        posts: [
          { id: 'post-1', username: 'user1', url: 'https://ig.com/p/1', likes: 100, comments: 5 },
          { id: 'post-2', username: 'user1', url: 'https://ig.com/p/2', likes: 200, comments: 10 },
        ],
      } as any)

      expect(prisma.post.upsert).toHaveBeenCalledTimes(2)
      expect(prisma.scrapingRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'completed', phase: 'finished' }),
        }),
      )
      expect(result.saved).toBe(2)
    })

    it('throws NotFoundException when run does not exist', async () => {
      prisma.scrapingRun.findUnique.mockResolvedValue(null)
      await expect(service.ingestPosts({ runId: 'missing', posts: [] } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })
  })

  describe('listRuns', () => {
    it('returns runs ordered by createdAt desc, limited to 50', async () => {
      prisma.scrapingRun.findMany.mockResolvedValue([])
      await service.listRuns('brand-1')
      expect(prisma.scrapingRun.findMany).toHaveBeenCalledWith({
        where: { brandId: 'brand-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    })
  })

  describe('getRun', () => {
    it('returns a run by id', async () => {
      const run = { id: 'run-1' }
      prisma.scrapingRun.findUnique.mockResolvedValue(run as any)
      const result = await service.getRun('run-1')
      expect(result).toEqual(run)
    })

    it('throws NotFoundException when run does not exist', async () => {
      prisma.scrapingRun.findUnique.mockResolvedValue(null)
      await expect(service.getRun('missing')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
