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
    { concept: 'You are not bad at consistency — you just have a system built for someone else. Most productivity frameworks were designed for office workers, not creators. Your brain is not broken; the template is.' },
    { concept: 'The brands that grow fastest right now are not posting more — they are posting with a point of view. One clear perspective beats ten generic updates every time. This is not a content volume problem.' },
  ],
  briefSummary: 'Generated 2 ideas on brand positioning and creative systems.',
}

const baseRequest = {
  topic: 'personal brand growth for independent creators',
  language: 'English',
  count: 2,
}

describe('generateContentIdeas()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns IdeationOutput on successful API call', async () => {
    mockParseCompletion.mockResolvedValue({ data: validIdeationOutput })

    const result = await generateContentIdeas(baseRequest)

    expect(result.ideas).toHaveLength(2)
    expect(result.briefSummary).toBe('Generated 2 ideas on brand positioning and creative systems.')
  })

  it('throws when topic is missing', async () => {
    await expect(
      generateContentIdeas({ topic: '', language: 'Spanish', count: 5 }),
    ).rejects.toThrow('Topic is required for idea generation.')
  })

  it('includes topic in the user message', async () => {
    let capturedMessages: unknown[] = []
    mockParseCompletion.mockImplementation((params: { messages: unknown[] }) => {
      capturedMessages = params.messages
      return Promise.resolve({ data: validIdeationOutput })
    })

    await generateContentIdeas({ ...baseRequest, topic: 'unique-topic-string-for-test' })

    const userMessage = capturedMessages.find((m: unknown) => {
      const msg = m as { role: string; content: string }
      return msg.role === 'user'
    }) as { role: string; content: string } | undefined

    expect(userMessage?.content).toContain('unique-topic-string-for-test')
  })

  it('includes language in the system prompt', async () => {
    let capturedMessages: unknown[] = []
    mockParseCompletion.mockImplementation((params: { messages: unknown[] }) => {
      capturedMessages = params.messages
      return Promise.resolve({ data: validIdeationOutput })
    })

    await generateContentIdeas({ ...baseRequest, language: 'Italian' })

    const systemMessage = capturedMessages.find((m: unknown) => {
      const msg = m as { role: string; content: string }
      return msg.role === 'system'
    }) as { role: string; content: string } | undefined

    expect(systemMessage?.content).toContain('Italian')
  })

  it('includes recent content in user message when provided', async () => {
    let capturedMessages: unknown[] = []
    mockParseCompletion.mockImplementation((params: { messages: unknown[] }) => {
      capturedMessages = params.messages
      return Promise.resolve({ data: validIdeationOutput })
    })

    await generateContentIdeas({
      ...baseRequest,
      recentContent: ['unique-recent-caption-for-test'],
    })

    const userMessage = capturedMessages.find((m: unknown) => {
      const msg = m as { role: string; content: string }
      return msg.role === 'user'
    }) as { role: string; content: string } | undefined

    expect(userMessage?.content).toContain('unique-recent-caption-for-test')
  })

  it('sends topic as user message even when recentContent is empty', async () => {
    let capturedMessages: unknown[] = []
    mockParseCompletion.mockImplementation((params: { messages: unknown[] }) => {
      capturedMessages = params.messages
      return Promise.resolve({ data: validIdeationOutput })
    })

    await generateContentIdeas(baseRequest)

    const userMessage = capturedMessages.find((m: unknown) => {
      const msg = m as { role: string; content: string }
      return msg.role === 'user'
    }) as { role: string; content: string } | undefined

    expect(userMessage?.content).toContain(baseRequest.topic)
  })
})
