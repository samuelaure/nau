import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { prisma } from '@/modules/shared/prisma'
import { composeVideoWithAgent } from '@/modules/video/agent'

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
  },
}))

vi.mock('@/modules/video/agent', () => ({
  composeVideoWithAgent: vi.fn(),
}))

describe('Generator Cron API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes APPROVED ideas and creates PENDING compositions', async () => {
    const mockIdea = {
      id: 'idea1',
      ideaText: 'A video about coding',
      accountId: 'acc1',
      account: { id: 'acc1' },
    }
    const mockPersona = { id: 'per1', autoApproveCompositions: false }
    const mockComp = { tracks: { media: [] }, caption: 'Cool video' }

    ;(prisma.contentIdea.findMany as any).mockResolvedValue([mockIdea])
    ;(prisma.brandPersona.findFirst as any).mockResolvedValue(mockPersona)
    ;(composeVideoWithAgent as any).mockResolvedValue({
      composition: mockComp,
      templateId: 'temp1',
    })

    const response = await GET()
    const data = await response.json()

    expect(data.results[0].status).toBe('success')
    expect(data.results[0].action).toBe('Generated as Draft')
    expect(prisma.composition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'DRAFT',
        templateId: 'temp1',
        caption: 'Cool video',
      }),
    })
    expect(prisma.contentIdea.update).toHaveBeenCalledWith({
      where: { id: 'idea1' },
      data: { status: 'USED' },
    })
  })

  it('auto-approves compositions if persona allows it', async () => {
    const mockIdea = {
      id: 'idea2',
      ideaText: 'Viral hook',
      accountId: 'acc1',
      account: { id: 'acc1' },
    }
    const mockPersona = { id: 'per1', autoApproveCompositions: true }
    const mockComp = { tracks: { media: [] } }

    ;(prisma.contentIdea.findMany as any).mockResolvedValue([mockIdea])
    ;(prisma.brandPersona.findFirst as any).mockResolvedValue(mockPersona)
    ;(composeVideoWithAgent as any).mockResolvedValue({
      composition: mockComp,
      templateId: 'temp1',
    })

    const response = await GET()
    const data = await response.json()

    expect(data.results[0].action).toBe('Generated & Approved')
    expect(prisma.composition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'APPROVED' }),
    })
  })
})
