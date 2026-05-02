import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { prisma } from '@/modules/shared/prisma'
import { publishComposition } from '@/modules/publisher/publish-orchestrator'

vi.mock('@/modules/shared/prisma', () => ({
  prisma: {
    post: {
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

function buildPost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'post1',
    brandId: 'brand1',
    templateId: 'tpl1',
    format: 'reel',
    status: 'RENDERED_APPROVED',
    scheduledAt: new Date(Date.now() - 1000),
    publishAttempts: 0,
    videoUrl: 'https://r2.example.com/outputs/post1.mp4',
    coverUrl: null,
    caption: 'Test caption',
    hashtags: ['test'],
    brand: {
      socialProfiles: [
        {
          id: 'sp1',
          accessToken: 'token',
          platformId: 'ig123',
          tokenExpiresAt: null,
          username: 'samuel',
        },
      ],
    },
    template: {
      id: 'tpl1',
      brandConfigs: [{ brandId: 'brand1', templateId: 'tpl1', autoApprovePost: true }],
    },
    ...overrides,
  }
}

describe('Publisher Cron API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishes posts when BrandTemplateConfig.autoApprovePost is true', async () => {
    const post = buildPost()
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([post])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      externalId: 'ig_media_id',
      permalink: 'https://ig.com/p/123',
    })

    const response = await GET(mockRequest)
    const data = await response.json()

    expect(data.results).toContainEqual(
      expect.objectContaining({ postId: 'post1', status: 'success' }),
    )
    expect(publishComposition).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'post1', format: 'reel' }),
    )
    expect(prisma.contentPlanner.updateMany).toHaveBeenCalledWith({
      where: { brandId: 'brand1', isDefault: true },
      data: expect.objectContaining({ lastPostedAt: expect.any(Date) }),
    })
  })

  it('skips posts when autoApprovePost is false and status is not PUBLISHING', async () => {
    const post = buildPost({
      template: {
        id: 'tpl1',
        brandConfigs: [{ brandId: 'brand1', templateId: 'tpl1', autoApprovePost: false }],
      },
    })
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([post])

    await GET(mockRequest)

    expect(publishComposition).not.toHaveBeenCalled()
  })

  it('publishes when status is PUBLISHING even if autoApprovePost is false', async () => {
    const post = buildPost({
      status: 'PUBLISHING',
      template: {
        id: 'tpl1',
        brandConfigs: [{ brandId: 'brand1', templateId: 'tpl1', autoApprovePost: false }],
      },
    })
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([post])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

    await GET(mockRequest)

    expect(publishComposition).toHaveBeenCalled()
  })

  it('increments publishAttempts on orchestrator failure', async () => {
    const post = buildPost({ id: 'post2', publishAttempts: 1, status: 'RENDERED_APPROVED' })
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([post])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'IG API timeout',
    })

    const response = await GET(mockRequest)
    const data = await response.json()

    expect(data.results[0].status).toBe('failed')
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 'post2' },
      data: {
        publishAttempts: 2,
        lastPublishError: 'IG API timeout',
        status: 'RENDERED_APPROVED',
      },
    })
  })

  it('sets status to PUBLISHING after 3 failed attempts', async () => {
    const post = buildPost({ id: 'post3', publishAttempts: 2, status: 'RENDERED_APPROVED' })
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([post])
    ;(publishComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Persistent error',
    })

    await GET(mockRequest)

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 'post3' },
      data: {
        publishAttempts: 3,
        lastPublishError: 'Persistent error',
        status: 'PUBLISHING',
      },
    })
  })

  it('skips posts with no social profile', async () => {
    const post = buildPost({ brand: { socialProfiles: [] } })
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([post])

    await GET(mockRequest)

    expect(publishComposition).not.toHaveBeenCalled()
  })
})
