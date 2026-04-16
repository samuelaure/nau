import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import OpenAI from 'openai'
import { generateContentIdeas } from '../ideation.service'

// ─── Helpers ──────────────────────────────────────────────────────

const validIdeationOutput = {
  ideas: [
    {
      hook: 'Did you know 90% of people fail at this?',
      angle: 'Contrarian take on productivity',
      script: 'Full script content here...',
      cta: 'Follow for more tips',
      format: 'reel' as const,
    },
    {
      hook: 'Here is the framework I use',
      angle: 'Practical framework breakdown',
      script: 'Another full script...',
      cta: 'Save this for later',
      format: 'carousel' as const,
    },
  ],
  briefSummary: 'Generated 2 ideas focused on productivity.',
}

const baseContext = {
  brandName: 'TestBrand',
  brandDNA: 'We help entrepreneurs build better systems.',
  inspoItems: [],
}

// ─── Tests ────────────────────────────────────────────────────────

describe('generateContentIdeas()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  })

  it('throws when OPENAI_API_KEY is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    await expect(generateContentIdeas(baseContext)).rejects.toThrow(
      /OPENAI_API_KEY is not configured/,
    )
  })

  it('returns IdeationOutput on successful API call', async () => {
    ;(OpenAI as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      beta: {
        chat: {
          completions: {
            parse: vi.fn().mockResolvedValue({
              choices: [{ message: { parsed: validIdeationOutput } }],
            }),
          },
        },
      },
    }))

    const result = await generateContentIdeas(baseContext)

    expect(result.ideas).toHaveLength(2)
    expect(result.briefSummary).toBe('Generated 2 ideas focused on productivity.')
    expect(result.ideas[0].format).toBe('reel')
  })

  it('includes brand DNA in the messages sent to OpenAI', async () => {
    let capturedMessages: unknown[] = []
    ;(OpenAI as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      beta: {
        chat: {
          completions: {
            parse: vi.fn().mockImplementation((params: { messages: unknown[] }) => {
              capturedMessages = params.messages
              return Promise.resolve({
                choices: [{ message: { parsed: validIdeationOutput } }],
              })
            }),
          },
        },
      },
    }))

    await generateContentIdeas({
      ...baseContext,
      brandDNA: 'Unique brand DNA content for testing',
    })

    const userMessage = capturedMessages.find((m: unknown) => {
      const msg = m as { role: string; content: string }
      return msg.role === 'user'
    }) as { role: string; content: string } | undefined

    expect(userMessage?.content).toContain('Unique brand DNA content for testing')
  })

  it('includes inspo items in the prompt when provided', async () => {
    let capturedMessages: unknown[] = []
    ;(OpenAI as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      beta: {
        chat: {
          completions: {
            parse: vi.fn().mockImplementation((params: { messages: unknown[] }) => {
              capturedMessages = params.messages
              return Promise.resolve({
                choices: [{ message: { parsed: validIdeationOutput } }],
              })
            }),
          },
        },
      },
    }))

    await generateContentIdeas({
      ...baseContext,
      inspoItems: [
        {
          id: 'inspo-1',
          type: 'reel',
          note: 'Unique inspo note for testing',
          extractedHook: 'Compelling hook from inspo',
          extractedTheme: null,
          adaptedScript: null,
        },
      ],
    })

    const userMessage = capturedMessages.find((m: unknown) => {
      const msg = m as { role: string; content: string }
      return msg.role === 'user'
    }) as { role: string; content: string } | undefined

    expect(userMessage?.content).toContain('Unique inspo note for testing')
    expect(userMessage?.content).toContain('inspo-1')
  })

  it('works correctly with an empty inspo items array', async () => {
    ;(OpenAI as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      beta: {
        chat: {
          completions: {
            parse: vi.fn().mockResolvedValue({
              choices: [{ message: { parsed: validIdeationOutput } }],
            }),
          },
        },
      },
    }))

    const result = await generateContentIdeas({
      ...baseContext,
      inspoItems: [],
    })

    // Should succeed with empty inspo items
    expect(result.ideas).toBeDefined()
    expect(result.ideas.length).toBeGreaterThan(0)
  })

  it('throws when API returns no parsed content', async () => {
    ;(OpenAI as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      beta: {
        chat: {
          completions: {
            parse: vi.fn().mockResolvedValue({
              choices: [{ message: { parsed: null } }],
            }),
          },
        },
      },
    }))

    await expect(generateContentIdeas(baseContext)).rejects.toThrow(
      /Failed to parse ideation AI response/,
    )
  })
})
