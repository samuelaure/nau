import { describe, it, expect, vi } from 'vitest'

// daily-plan.service imports prisma at module level; mock it to prevent DB connection
vi.mock('@/modules/shared/prisma', () => ({
  prisma: {
    contentIdea: { findMany: vi.fn(), update: vi.fn() },
    brandPersona: { findFirst: vi.fn() },
  },
}))

import { resolveModelId } from '@/modules/composer/model-resolver'
import { detectHeadTalk, generateTopicHash } from '@/modules/planning/daily-plan.service'

// ─── resolveModelId ────────────────────────────────────────────────

describe('resolveModelId', () => {
  it('resolves OpenAI GPT-4o to correct provider and model', () => {
    const result = resolveModelId('OPENAI_GPT_4O')
    expect(result).toEqual({ provider: 'openai', model: 'gpt-4o' })
  })

  it('resolves OpenAI GPT-4o-mini', () => {
    const result = resolveModelId('OPENAI_GPT_4O_MINI')
    expect(result).toEqual({ provider: 'openai', model: 'gpt-4o-mini' })
  })

  it('resolves Groq Llama 3.3 to groq provider', () => {
    const result = resolveModelId('GROQ_LLAMA_3_3')
    expect(result).toEqual({ provider: 'groq', model: 'llama-3.3-70b-versatile' })
  })

  it('resolves Groq DeepSeek R1', () => {
    const result = resolveModelId('GROQ_DEEPSEEK_R1_70B')
    expect(result).toEqual({ provider: 'groq', model: 'deepseek-r1-distill-llama-70b' })
  })

  it('returns default Groq Llama model for unknown enum value', () => {
    const result = resolveModelId('UNKNOWN_MODEL')
    expect(result).toEqual({ provider: 'groq', model: 'llama-3.3-70b-versatile' })
  })
})

// ─── detectHeadTalk ────────────────────────────────────────────────

describe('detectHeadTalk', () => {
  it('returns true when idea contains "opinion"', () => {
    expect(detectHeadTalk('I want to share my opinion on this')).toBe(true)
  })

  it('returns true for "hot take" keyword', () => {
    expect(detectHeadTalk('Hot take: this framework is overrated')).toBe(true)
  })

  it('returns true for "story time" keyword', () => {
    expect(detectHeadTalk('Story time: how I lost everything')).toBe(true)
  })

  it('returns true for Spanish keyword "explica"', () => {
    expect(detectHeadTalk('Explica cómo funciona este concepto')).toBe(true)
  })

  it('returns true for Spanish keyword "opinión"', () => {
    expect(detectHeadTalk('Mi opinión sobre el mercado actual')).toBe(true)
  })

  it('returns false for unrelated content', () => {
    expect(detectHeadTalk('Here is a recipe for chocolate cake')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(detectHeadTalk('')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(detectHeadTalk('MY UNPOPULAR OPINION')).toBe(true)
  })
})

// ─── generateTopicHash ─────────────────────────────────────────────

describe('generateTopicHash', () => {
  it('returns a 12-character string', () => {
    const hash = generateTopicHash('Some topic text')
    expect(hash).toHaveLength(12)
  })

  it('returns only hex characters', () => {
    const hash = generateTopicHash('Some topic text')
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
  })

  it('is deterministic — same input always produces same hash', () => {
    const hash1 = generateTopicHash('reproducible input')
    const hash2 = generateTopicHash('reproducible input')
    expect(hash1).toBe(hash2)
  })

  it('normalizes case — "Hello World" and "hello world" produce the same hash', () => {
    expect(generateTopicHash('Hello World')).toBe(generateTopicHash('hello world'))
  })

  it('strips punctuation during normalization', () => {
    expect(generateTopicHash('Hello, World!')).toBe(generateTopicHash('Hello World'))
  })

  it('produces different hashes for different inputs', () => {
    expect(generateTopicHash('topic A')).not.toBe(generateTopicHash('topic B'))
  })
})
