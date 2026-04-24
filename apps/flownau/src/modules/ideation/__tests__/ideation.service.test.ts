import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockParseCompletion } = vi.hoisted(() => ({ mockParseCompletion: vi.fn() }))

vi.mock('@nau/llm-client', () => ({
  getClientForFeature: vi.fn(() => ({
    client: { parseCompletion: mockParseCompletion },
    model: 'gpt-4o',
  })),
}))

import { generateContentIdeas } from '../ideation.service'

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
  dna: 'We help entrepreneurs build better systems.',
  count: 2,
  inspoItems: [],
}

describe('generateContentIdeas()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns IdeationOutput on successful API call', async () => {
    mockParseCompletion.mockResolvedValue({ data: validIdeationOutput })

    const result = await generateContentIdeas(baseContext)

    expect(result.ideas).toHaveLength(2)
    expect(result.briefSummary).toBe('Generated 2 ideas focused on productivity.')
    expect(result.ideas[0].format).toBe('reel')
  })

  it('includes brand DNA in the messages sent to LLM', async () => {
    let capturedMessages: unknown[] = []
    mockParseCompletion.mockImplementation((params: { messages: unknown[] }) => {
      capturedMessages = params.messages
      return Promise.resolve({ data: validIdeationOutput })
    })

    await generateContentIdeas({ ...baseContext, dna: 'Unique brand DNA content for testing' })

    const userMessage = capturedMessages.find((m: unknown) => {
      const msg = m as { role: string; content: string }
      return msg.role === 'user'
    }) as { role: string; content: string } | undefined

    expect(userMessage?.content).toContain('Unique brand DNA content for testing')
  })

  it('includes inspo items in the prompt when provided', async () => {
    let capturedMessages: unknown[] = []
    mockParseCompletion.mockImplementation((params: { messages: unknown[] }) => {
      capturedMessages = params.messages
      return Promise.resolve({ data: validIdeationOutput })
    })

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
    mockParseCompletion.mockResolvedValue({ data: validIdeationOutput })

    const result = await generateContentIdeas({ ...baseContext, inspoItems: [] })

    expect(result.ideas).toBeDefined()
    expect(result.ideas.length).toBeGreaterThan(0)
  })
})
