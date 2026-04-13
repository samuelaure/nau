import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { prisma } from '@/modules/shared/prisma'
import { publishVideoToInstagram } from '@/modules/accounts/instagram'

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
    },
  },
}))

vi.mock('@/modules/accounts/instagram', () => ({
  publishVideoToInstagram: vi.fn(),
}))

vi.mock('@/modules/shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
}))

describe('Publisher Cron API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishes rendered compositions that are scheduled', async () => {
    const mockComp = {
      id: 'comp1',
      status: 'rendered',
      scheduledAt: new Date(Date.now() - 1000),
      publishAttempts: 0,
      videoUrl: 'https://r2.example.com/outputs/comp1.mp4',
      caption: 'Test caption',
      hashtags: ['test'],
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
        username: 'samuel',
      },
    }

    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockComp])
    ;(prisma.postingSchedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(publishVideoToInstagram as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'ig_media_id',
      permalink: 'https://ig.com/p/123',
    })

    const response = await GET()
    const data = await response.json()

    expect(data.results).toContainEqual(
      expect.objectContaining({ type: 'explicit', status: 'success' }),
    )
    // No renderAndUpload — rendering is decoupled
    expect(publishVideoToInstagram).toHaveBeenCalledWith({
      accessToken: 'token',
      instagramUserId: 'ig123',
      videoUrl: 'https://r2.example.com/outputs/comp1.mp4',
      caption: 'Test caption\n\n#test',
    })
    expect(prisma.composition.update).toHaveBeenCalledWith({
      where: { id: 'comp1' },
      data: {
        status: 'published',
        externalPostId: 'ig_media_id',
        externalPostUrl: 'https://ig.com/p/123',
      },
    })
  })

  it('increments publishAttempts on IG publish failure', async () => {
    const mockComp = {
      id: 'comp2',
      status: 'rendered',
      scheduledAt: new Date(Date.now() - 1000),
      publishAttempts: 1,
      videoUrl: 'https://r2.example.com/outputs/comp2.mp4',
      caption: 'Test',
      hashtags: [],
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
      },
    }

    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockComp])
    ;(prisma.postingSchedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(publishVideoToInstagram as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IG API timeout'))

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
      status: 'rendered',
      scheduledAt: new Date(Date.now() - 1000),
      publishAttempts: 2,
      videoUrl: 'https://r2.example.com/outputs/comp3.mp4',
      caption: 'Test',
      hashtags: [],
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
      },
    }

    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockComp])
    ;(prisma.postingSchedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(publishVideoToInstagram as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Persistent error'))

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

  it('auto-posts rendered compositions when schedule is due', async () => {
    const mockSchedule = {
      id: 'sched1',
      accountId: 'acc1',
      frequencyDays: 1,
      lastPostedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
      },
    }
    const mockComp = {
      id: 'comp4',
      status: 'rendered',
      videoUrl: 'https://r2.example.com/outputs/comp4.mp4',
      caption: 'Auto post',
      hashtags: ['auto'],
      publishAttempts: 0,
      account: mockSchedule.account,
    }

    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]) // No explicit
    ;(prisma.postingSchedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockSchedule])
    ;(prisma.composition.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockComp)
    ;(publishVideoToInstagram as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'ig1', permalink: 'p1' })

    const response = await GET()
    const data = await response.json()

    expect(data.results).toContainEqual(
      expect.objectContaining({ type: 'auto', status: 'success' }),
    )
    expect(prisma.postingSchedule.update).toHaveBeenCalled()
    expect(prisma.composition.update).toHaveBeenCalledWith({
      where: { id: 'comp4' },
      data: expect.objectContaining({ status: 'published' }),
    })
  })
})
