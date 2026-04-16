import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'

// Mock all dependencies
vi.mock('@/modules/shared/prisma', () => ({
  prisma: {
    contentIdea: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    brandPersona: {
      findFirst: vi.fn(),
    },
    composition: {
      create: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/modules/composer/scene-composer', () => ({
  compose: vi.fn(),
}))

vi.mock('@/modules/composer/asset-curator', () => ({
  selectAssetsForCreative: vi.fn(),
  commitAssetUsage: vi.fn(),
}))

vi.mock('@/modules/composer/timeline-compiler', () => ({
  compileTimeline: vi.fn(),
}))

vi.mock('@/modules/shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
}))

import { prisma } from '@/modules/shared/prisma'
import { compose } from '@/modules/composer/scene-composer'
import { selectAssetsForCreative, commitAssetUsage } from '@/modules/composer/asset-curator'
import { compileTimeline } from '@/modules/composer/timeline-compiler'

describe('Composer Cron (v2 Pipeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns early when no approved ideas exist', async () => {
    ;(prisma.contentIdea.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const response = await GET()
    const data = await response.json()

    expect(data.message).toBe('No approved ideas to process')
    expect(data.results).toEqual([])
  })

  it('processes approved ideas through the full v2 pipeline', async () => {
    const mockIdea = {
      id: 'idea1',
      ideaText: 'A video about nature',
      accountId: 'acc1',
      account: { id: 'acc1' },
    }
    const mockPersona = { id: 'per1', autoApproveCompositions: false }
    const mockCreative = {
      scenes: [
        { type: 'hook-text', slots: { hook: 'Amazing nature' }, mood: 'calm' },
        { type: 'text-over-media', slots: { text: 'Explore the wild' }, mood: 'nature' },
        { type: 'cta-card', slots: { cta: 'Follow for more' }, mood: 'upbeat' },
      ],
      caption: 'Nature is beautiful',
      hashtags: ['nature', 'explore'],
      coverSceneIndex: 0,
    }
    const mockSchema = {
      format: 'reel',
      fps: 30,
      durationInFrames: 450,
      width: 1080,
      height: 1920,
      tracks: { overlay: [], media: [], text: [], audio: [] },
    }

    ;(prisma.contentIdea.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockIdea])
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    ;(compose as ReturnType<typeof vi.fn>).mockResolvedValue({
      creative: mockCreative,
      personaName: 'TestPersona',
    })
    ;(selectAssetsForCreative as ReturnType<typeof vi.fn>).mockResolvedValue({
      sceneAssets: new Map(),
      audioAsset: null,
    })
    ;(compileTimeline as ReturnType<typeof vi.fn>).mockReturnValue({
      schema: mockSchema,
      resolvedScenes: [],
      audio: null,
    })
    ;(prisma.composition.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'comp1',
    })
    ;(prisma.contentIdea.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(commitAssetUsage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const response = await GET()
    const data = await response.json()

    expect(data.succeeded).toBe(1)
    expect(data.failed).toBe(0)
    expect(data.results[0].status).toBe('success')
    expect(data.results[0].compositionId).toBe('comp1')

    expect(prisma.composition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        format: 'reel',
        status: 'DRAFT',
        caption: 'Nature is beautiful',
        hashtags: ['nature', 'explore'],
      }),
    })

    expect(prisma.contentIdea.update).toHaveBeenCalledWith({
      where: { id: 'idea1' },
      data: { status: 'USED' },
    })
  })

  it('auto-approves when persona allows it', async () => {
    const mockIdea = {
      id: 'idea2',
      ideaText: 'Cooking tips',
      accountId: 'acc1',
      account: { id: 'acc1' },
    }
    const mockPersona = { id: 'per1', autoApproveCompositions: true }

    ;(prisma.contentIdea.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockIdea])
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    ;(compose as ReturnType<typeof vi.fn>).mockResolvedValue({
      creative: {
        scenes: [{ type: 'hook-text', slots: { hook: 'Cook like a pro' } }],
        caption: 'Tips',
        hashtags: ['cooking'],
        coverSceneIndex: 0,
      },
      personaName: 'Chef',
    })
    ;(selectAssetsForCreative as ReturnType<typeof vi.fn>).mockResolvedValue({
      sceneAssets: new Map(),
      audioAsset: null,
    })
    ;(compileTimeline as ReturnType<typeof vi.fn>).mockReturnValue({
      schema: {
        format: 'reel',
        fps: 30,
        durationInFrames: 150,
        width: 1080,
        height: 1920,
        tracks: { overlay: [], media: [], text: [], audio: [] },
      },
      resolvedScenes: [],
      audio: null,
    })
    ;(prisma.composition.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'comp2' })
    ;(prisma.contentIdea.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(commitAssetUsage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const response = await GET()
    const _data = await response.json()

    expect(prisma.composition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'APPROVED' }),
    })
  })

  it('handles composition failure gracefully without crashing the batch', async () => {
    const mockIdea = {
      id: 'idea3',
      ideaText: 'Broken idea',
      accountId: 'acc1',
      account: { id: 'acc1' },
    }

    ;(prisma.contentIdea.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockIdea])
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'per1' })
    ;(compose as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('AI failed'))

    const response = await GET()
    const data = await response.json()

    expect(data.succeeded).toBe(0)
    expect(data.failed).toBe(1)
    expect(data.results[0].status).toBe('failed')
    expect(data.results[0].error).toContain('AI failed')
  })
})
