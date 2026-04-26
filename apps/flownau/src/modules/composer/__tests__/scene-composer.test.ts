import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockParseCompletion } = vi.hoisted(() => ({ mockParseCompletion: vi.fn() }))

vi.mock('@nau/llm-client', () => ({
  createLLMClient: vi.fn(() => ({ parseCompletion: mockParseCompletion })),
}))

vi.mock('@/modules/shared/prisma', () => ({
  prisma: {
    brandPersona: { findUnique: vi.fn(), findFirst: vi.fn() },
    asset: { findMany: vi.fn() },
  },
}))

vi.mock('@/modules/shared/settings', () => ({
  getSetting: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/modules/composer/model-resolver', () => ({
  resolveModelId: vi.fn(),
}))

import { compose } from '../scene-composer'
import { prisma } from '@/modules/shared/prisma'
import { resolveModelId } from '@/modules/composer/model-resolver'

const mockPersona = {
  id: 'persona-1',
  name: 'Test Persona',
  brandId: 'account-1',
  isDefault: true,
  systemPrompt: 'You are a test creative director.',
  modelSelection: 'GROQ_LLAMA_3_3' as const,
  language: 'en',
  tone: 'casual',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const validCreativeDirection = {
  scenes: [
    {
      type: 'hook-text',
      slots: { hook: 'This is amazing!' },
      mood: 'energetic',
      assetHint: 'urban',
      durationSec: 3,
    },
    {
      type: 'cta-card',
      slots: { cta: 'Follow for more' },
      mood: 'motivational',
      durationSec: 3,
    },
  ],
  caption: 'Test caption for the post.',
  hashtags: ['test', 'vitest'],
  coverSceneIndex: 0,
  suggestedAudioMood: 'upbeat',
}

describe('compose()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.asset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(resolveModelId as ReturnType<typeof vi.fn>).mockReturnValue({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      registryId: 'groq/llama-3.3-70b',
    })
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
  })

  it('uses platform default when no Brand Persona is found for account', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    mockParseCompletion.mockResolvedValue({ data: validCreativeDirection })

    const result = await compose({ ideaText: 'test idea', brandId: 'account-1', format: 'reel' })
    expect(result.personaName).toBe('Platform Default')
  })

  it('returns CreativeDirection via Groq path when Groq model is selected', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    mockParseCompletion.mockResolvedValue({ data: validCreativeDirection })

    const result = await compose({ ideaText: 'test idea', brandId: 'account-1', format: 'reel' })

    expect(result.creative.scenes).toHaveLength(2)
    expect(result.creative.caption).toBe('Test caption for the post.')
    expect(result.personaName).toBe('Test Persona')
  })

  it('retries once on first AI failure and succeeds on second attempt', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)

    let callCount = 0
    mockParseCompletion.mockImplementation(() => {
      callCount++
      if (callCount === 1) throw new Error('LLM timeout')
      return Promise.resolve({ data: validCreativeDirection })
    })

    const result = await compose({ ideaText: 'retry test idea', brandId: 'account-1', format: 'reel' })

    expect(result.creative.scenes).toHaveLength(2)
    expect(callCount).toBe(2)
  })

  it('throws with "after 2 attempts" message when both AI calls fail', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    mockParseCompletion.mockRejectedValue(new Error('LLM always fails'))

    await expect(
      compose({ ideaText: 'failing idea', brandId: 'account-1', format: 'reel' }),
    ).rejects.toThrow(/after 2 attempts/)
  })

  it('clamps coverSceneIndex to 0 when AI returns out-of-range value', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    mockParseCompletion.mockResolvedValue({ data: { ...validCreativeDirection, coverSceneIndex: 99 } })

    const result = await compose({ ideaText: 'cover index test', brandId: 'account-1', format: 'reel' })

    expect(result.creative.coverSceneIndex).toBe(0)
  })

  it('Groq path: parses valid response successfully', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    mockParseCompletion.mockResolvedValue({ data: validCreativeDirection })

    const result = await compose({ ideaText: 'json parse test', brandId: 'account-1', format: 'reel' })

    expect(result.creative).toBeDefined()
    expect(result.creative.hashtags).toContain('test')
  })
})
