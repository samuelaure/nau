import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { prisma } from '@/modules/shared/prisma'
import { renderAndUpload } from '@/modules/video/renderer'
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

vi.mock('@/modules/video/renderer', () => ({
  renderAndUpload: vi.fn(),
}))

vi.mock('@/modules/accounts/instagram', () => ({
  publishVideoToInstagram: vi.fn(),
}))

describe('Publisher Cron API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes SCHEDULED compositions that are due', async () => {
    const mockComp = {
      id: 'comp1',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() - 1000),
      publishAttempts: 0,
      payload: {},
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
        username: 'samuel',
      },
    }

    ;(prisma.composition.findMany as any).mockResolvedValue([mockComp])
    ;(prisma.postingSchedule.findMany as any).mockResolvedValue([])
    ;(renderAndUpload as any).mockResolvedValue('key/path.mp4')
    ;(publishVideoToInstagram as any).mockResolvedValue({
      id: 'ig_media_id',
      permalink: 'https://ig.com/p/123',
    })

    const response = await GET()
    const data = await response.json()

    expect(data.results).toContainEqual(
      expect.objectContaining({ type: 'explicit', status: 'success' }),
    )
    expect(renderAndUpload).toHaveBeenCalled()
    expect(publishVideoToInstagram).toHaveBeenCalled()
    expect(prisma.composition.update).toHaveBeenCalledWith({
      where: { id: 'comp1' },
      data: {
        status: 'PUBLISHED',
        videoUrl: expect.stringContaining('key/path.mp4'),
        externalPostId: 'ig_media_id',
        externalPostUrl: 'https://ig.com/p/123',
      },
    })
  })

  it('increments publishAttempts on failure', async () => {
    const mockComp = {
      id: 'comp2',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() - 1000),
      publishAttempts: 1,
      payload: {},
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
      },
    }

    ;(prisma.composition.findMany as any).mockResolvedValue([mockComp])
    ;(prisma.postingSchedule.findMany as any).mockResolvedValue([])
    ;(renderAndUpload as any).mockRejectedValue(new Error('Render failed'))

    const response = await GET()
    const data = await response.json()

    expect(data.results[0].status).toBe('failed')
    expect(prisma.composition.update).toHaveBeenCalledWith({
      where: { id: 'comp2' },
      data: {
        publishAttempts: 2,
        lastPublishError: 'Render failed',
        status: 'SCHEDULED',
      },
    })
  })

  it('sets status to FAILED after 3 attempts', async () => {
    const mockComp = {
      id: 'comp3',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() - 1000),
      publishAttempts: 2,
      payload: {},
      account: {
        id: 'acc1',
        accessToken: 'token',
        platformId: 'ig123',
      },
    }

    ;(prisma.composition.findMany as any).mockResolvedValue([mockComp])
    ;(prisma.postingSchedule.findMany as any).mockResolvedValue([])
    ;(renderAndUpload as any).mockRejectedValue(new Error('Persistent error'))

    await GET()

    expect(prisma.composition.update).toHaveBeenCalledWith({
      where: { id: 'comp3' },
      data: {
        publishAttempts: 3,
        lastPublishError: 'Persistent error',
        status: 'FAILED',
      },
    })
  })

  it('processes auto-posting for APPROVED compositions when due', async () => {
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
      status: 'APPROVED',
      payload: {},
      account: mockSchedule.account,
    }

    ;(prisma.composition.findMany as any).mockResolvedValue([]) // No explicit
    ;(prisma.postingSchedule.findMany as any).mockResolvedValue([mockSchedule])
    ;(prisma.composition.findFirst as any).mockResolvedValue(mockComp)
    ;(renderAndUpload as any).mockResolvedValue('key/path.mp4')
    ;(publishVideoToInstagram as any).mockResolvedValue({ id: 'ig1', permalink: 'p1' })

    const response = await GET()
    const data = await response.json()

    expect(data.results).toContainEqual(
      expect.objectContaining({ type: 'auto', status: 'success' }),
    )
    expect(prisma.postingSchedule.update).toHaveBeenCalled()
    expect(prisma.composition.update).toHaveBeenCalledWith({
      where: { id: 'comp4' },
      data: expect.objectContaining({ status: 'PUBLISHED' }),
    })
  })
})
