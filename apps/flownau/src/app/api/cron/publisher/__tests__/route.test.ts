import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { prisma } from '@/modules/shared/prisma'
import { publishComposition } from '@/modules/publisher/publish-orchestrator'
import { scheduleRenderedCompositions } from '@/modules/publisher/scheduler'

vi.mock('@/modules/shared/prisma', () => ({
  prisma: {
    composition: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    postingSchedule: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/modules/publisher/publish-orchestrator', () => ({
  publishComposition: vi.fn(),
}))

vi.mock('@/modules/publisher/scheduler', () => ({
  scheduleRenderedCompositions: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/modules/shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
}))

describe('Publisher Cron API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls scheduleRenderedCompositions on run', async () => {
    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await GET()
    expect(scheduleRenderedCompositions).toHaveBeenCalled()
  })

  it('publishes rendered compositions that are scheduled', async () => {
    const mockComp = {
      id: 'comp1',
      accountId: 'acc1',
      format: 'reel',
      status: 'rendered',
      scheduledAt: new Date(Date.now() - 1000),
      publishAttempts: 0,
      videoUrl: 'https://r2.example.com/outputs/comp1.mp4',
      coverUrl: null,
      caption: 'Test caption',
      hashtags: ['test'],
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
        tokenExpiresAt: null,
        username: 'samuel',
      },
    }

    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockComp])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      externalId: 'ig_media_id',
      permalink: 'https://ig.com/p/123',
    })

    const response = await GET()
    const data = await response.json()

    expect(data.results).toContainEqual(
      expect.objectContaining({ type: 'explicit', status: 'success' }),
    )
    expect(publishComposition).toHaveBeenCalledWith(mockComp)
    expect(prisma.postingSchedule.updateMany).toHaveBeenCalledWith({
      where: { accountId: mockComp.account.id },
      data: expect.any(Object),
    })
  })

  it('increments publishAttempts on orchestrator failure', async () => {
    const mockComp = {
      id: 'comp2',
      format: 'reel',
      status: 'rendered',
      scheduledAt: new Date(Date.now() - 1000),
      publishAttempts: 1,
      videoUrl: 'https://r2.example.com/outputs/comp2.mp4',
      coverUrl: null,
      caption: 'Test',
      hashtags: [],
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
        tokenExpiresAt: null,
      },
    }

    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockComp])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'IG API timeout',
    })

    const response = await GET()
    const data = await response.json()

    expect(data.results[0].status).toBe('failed')
    expect(prisma.composition.update).toHaveBeenCalledWith({
      where: { id: 'comp2' },
      data: {
        publishAttempts: 2,
        lastPublishError: 'IG API timeout',
        status: 'rendered',
      },
    })
  })

  it('sets status to failed after 3 attempts', async () => {
    const mockComp = {
      id: 'comp3',
      format: 'trial_reel',
      status: 'rendered',
      scheduledAt: new Date(Date.now() - 1000),
      publishAttempts: 2,
      videoUrl: 'https://r2.example.com/outputs/comp3.mp4',
      coverUrl: null,
      caption: 'Test',
      hashtags: [],
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
        tokenExpiresAt: null,
      },
    }

    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockComp])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Persistent error',
    })

    await GET()

    expect(prisma.composition.update).toHaveBeenCalledWith({
      where: { id: 'comp3' },
      data: {
        publishAttempts: 3,
        lastPublishError: 'Persistent error',
        status: 'failed',
      },
    })
  })
})
