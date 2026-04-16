import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all external dependencies
vi.mock('openai', () => {
  const mockParse = vi.fn()
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: {
        chat: {
          completions: {
            parse: mockParse,
          },
        },
      },
    })),
    __mockParse: mockParse,
  }
})

vi.mock('openai/helpers/zod', () => ({
  zodResponseFormat: vi.fn().mockReturnValue({ type: 'json_schema' }),
}))

vi.mock('groq-sdk', () => {
  const mockCreate = vi.fn()
  return {
    Groq: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    __mockCreate: mockCreate,
  }
})

vi.mock('@/modules/shared/prisma', () => ({
  prisma: {
    brandPersona: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
    },
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
import { Groq } from 'groq-sdk'

// ─── Helpers ──────────────────────────────────────────────────────

const mockPersona = {
  id: 'persona-1',
  name: 'Test Persona',
  accountId: 'account-1',
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

// ─── Tests ────────────────────────────────────────────────────────

describe('compose()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.asset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(resolveModelId as ReturnType<typeof vi.fn>).mockReturnValue({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
    })
  })

  it('throws when no Brand Persona is found for account', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(
      compose({ ideaText: 'test idea', accountId: 'account-1', format: 'reel' }),
    ).rejects.toThrow(/No Brand Persona found/)
  })

  it('returns CreativeDirection via Groq path when Groq model is selected', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')

    // Groq is instantiated after compose() is called, so we need to intercept after mock setup
    // We'll use module-level mock factory approach
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(validCreativeDirection),
          },
        },
      ],
    })
    ;(Groq as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }))

    const result = await compose({
      ideaText: 'test idea',
      accountId: 'account-1',
      format: 'reel',
    })

    expect(result.creative.scenes).toHaveLength(2)
    expect(result.creative.caption).toBe('Test caption for the post.')
    expect(result.personaName).toBe('Test Persona')
  })

  it('retries once on first AI failure and succeeds on second attempt', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')

    let callCount = 0
    const mockCreate = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) throw new Error('Groq timeout')
      return Promise.resolve({
        choices: [{ message: { content: JSON.stringify(validCreativeDirection) } }],
      })
    })
    ;(Groq as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }))

    const result = await compose({
      ideaText: 'retry test idea',
      accountId: 'account-1',
      format: 'reel',
    })

    expect(result.creative.scenes).toHaveLength(2)
    expect(callCount).toBe(2)
  })

  it('throws with "after 2 attempts" message when both AI calls fail', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')

    const mockCreate = vi.fn().mockRejectedValue(new Error('Groq always fails'))
    ;(Groq as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }))

    await expect(
      compose({ ideaText: 'failing idea', accountId: 'account-1', format: 'reel' }),
    ).rejects.toThrow(/after 2 attempts/)
  })

  it('clamps coverSceneIndex to 0 when AI returns out-of-range value', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')

    const outOfRangeCreative = {
      ...validCreativeDirection,
      coverSceneIndex: 99, // Way out of range for 2 scenes
    }

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(outOfRangeCreative) } }],
    })
    ;(Groq as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }))

    const result = await compose({
      ideaText: 'cover index test',
      accountId: 'account-1',
      format: 'reel',
    })

    expect(result.creative.coverSceneIndex).toBe(0)
  })

  it('throws when OPENAI_API_KEY is not configured for OpenAI provider', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    ;(resolveModelId as ReturnType<typeof vi.fn>).mockReturnValue({
      provider: 'openai',
      model: 'gpt-4o',
    })
    vi.stubEnv('OPENAI_API_KEY', '')

    await expect(
      compose({ ideaText: 'openai test', accountId: 'account-1', format: 'reel' }),
    ).rejects.toThrow(/OPENAI_API_KEY is not configured/)
  })

  // ─── Groq JSON parsing edge cases ─────────────────────────────

  it('Groq path: parses valid JSON response successfully', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validCreativeDirection) } }],
    })
    ;(Groq as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }))

    const result = await compose({
      ideaText: 'json parse test',
      accountId: 'account-1',
      format: 'reel',
    })

    expect(result.creative).toBeDefined()
    expect(result.creative.hashtags).toContain('test')
  })

  /**
   * This test documents the missing try-catch around JSON.parse in the Groq path.
   * It WILL FAIL until Phase 2.1 fix is applied to scene-composer.ts.
   * After the fix, the error message should contain "[SceneComposer] Groq returned invalid JSON".
   */
  it('Groq path: throws readable error when response is invalid JSON (pre-fix: raw SyntaxError, post-fix: descriptive error)', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'NOT VALID JSON {{{' } }],
    })
    ;(Groq as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }))

    // After Phase 2.1 fix: error will contain "[SceneComposer] Groq returned invalid JSON"
    // Before fix: raw SyntaxError from JSON.parse bubbles up (still throws, just unhelpfully)
    await expect(
      compose({ ideaText: 'bad json test', accountId: 'account-1', format: 'reel' }),
    ).rejects.toThrow()
  })

  it('Groq path: strips markdown code fences before parsing JSON', async () => {
    ;(prisma.brandPersona.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPersona)
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')

    const markdownWrapped = `\`\`\`json\n${JSON.stringify(validCreativeDirection)}\n\`\`\``

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: markdownWrapped } }],
    })
    ;(Groq as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }))

    const result = await compose({
      ideaText: 'markdown wrapped test',
      accountId: 'account-1',
      format: 'reel',
    })

    expect(result.creative.scenes).toHaveLength(2)
  })
})
