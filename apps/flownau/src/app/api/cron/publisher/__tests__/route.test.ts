import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { prisma } from '@/modules/shared/prisma'
import { publishComposition } from '@/modules/publisher/publish-orchestrator'

vi.mock('@/modules/shared/prisma', () => ({
  prisma: {
    composition: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    contentPlanner: {
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/modules/publisher/publish-orchestrator', () => ({
  publishComposition: vi.fn(),
}))

vi.mock('@/modules/shared/nau-auth', () => ({
  validateCronSecret: vi.fn().mockReturnValue(true),
  unauthorizedCronResponse: vi.fn(),
}))

vi.mock('@/modules/shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
}))

const mockRequest = new Request('http://localhost/api/cron/publisher')

function buildComp(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'comp1',
    brandId: 'acc1',
    templateId: 'tpl1',
    format: 'reel',
    status: 'RENDERED',
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
    template: {
      id: 'tpl1',
      brandConfigs: [{ brandId: 'acc1', templateId: 'tpl1', autoApprovePost: true }],
    },
    ...overrides,
  }
}

describe('Publisher Cron API (Phase 18)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishes compositions when BrandTemplateConfig.autoApprovePost is true', async () => {
    const comp = buildComp()
    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([comp])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      externalId: 'ig_media_id',
      permalink: 'https://ig.com/p/123',
    })

    const response = await GET(mockRequest)
    const data = await response.json()

    expect(data.results).toContainEqual(
      expect.objectContaining({ type: 'explicit', status: 'success' }),
    )
    expect(publishComposition).toHaveBeenCalledWith(comp)
    expect(prisma.contentPlanner.updateMany).toHaveBeenCalledWith({
      where: { brandId: 'acc1', isDefault: true },
      data: expect.objectContaining({ lastPostedAt: expect.any(Date) }),
    })
  })

  it('skips compositions when autoApprovePost is false and status is not PUBLISHING', async () => {
    const comp = buildComp({
      template: {
        id: 'tpl1',
        brandConfigs: [{ brandId: 'acc1', templateId: 'tpl1', autoApprovePost: false }],
      },
    })
    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([comp])

    await GET(mockRequest)

    expect(publishComposition).not.toHaveBeenCalled()
  })

  it('publishes when status is PUBLISHING even if autoApprovePost is false', async () => {
    const comp = buildComp({
      status: 'PUBLISHING',
      template: {
        id: 'tpl1',
        brandConfigs: [{ brandId: 'acc1', templateId: 'tpl1', autoApprovePost: false }],
      },
    })
    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([comp])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    })

    await GET(mockRequest)

    expect(publishComposition).toHaveBeenCalledWith(comp)
  })

  it('increments publishAttempts on orchestrator failure', async () => {
    const comp = buildComp({ id: 'comp2', publishAttempts: 1, status: 'RENDERED' })
    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([comp])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'IG API timeout',
    })

    const response = await GET(mockRequest)
    const data = await response.json()

    expect(data.results[0].status).toBe('failed')
    expect(prisma.composition.update).toHaveBeenCalledWith({
      where: { id: 'comp2' },
      data: {
        publishAttempts: 2,
        lastPublishError: 'IG API timeout',
        status: 'RENDERED',
      },
    })
  })

  it('sets status to failed after 3 attempts', async () => {
    const comp = buildComp({ id: 'comp3', publishAttempts: 2, format: 'trial_reel' })
    ;(prisma.composition.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([comp])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Persistent error',
    })

    await GET(mockRequest)

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
