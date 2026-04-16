import { describe, it, expect } from 'vitest'
import { detectHeadTalk, generateTopicHash } from '../daily-plan.service'

/**
 * Tests for pure utility functions in daily-plan.service.ts.
 * No mocks needed — these functions have no I/O dependencies.
 */

// ─── detectHeadTalk ────────────────────────────────────────────────

describe('detectHeadTalk()', () => {
  it('returns true when text contains "opinion"', () => {
    expect(detectHeadTalk('I want to share my opinion on this')).toBe(true)
  })

  it('returns true for "hot take"', () => {
    expect(detectHeadTalk('Hot take: this framework is overrated')).toBe(true)
  })

  it('returns true for "story time"', () => {
    expect(detectHeadTalk('Story time: how I lost my startup')).toBe(true)
  })

  it('returns true for "unpopular opinion"', () => {
    expect(detectHeadTalk('Unpopular opinion: remote work is overrated')).toBe(true)
  })

  it('returns true for "my take"', () => {
    expect(detectHeadTalk('My take on the current AI landscape')).toBe(true)
  })

  it('returns true for "react to"', () => {
    expect(detectHeadTalk('React to this viral trend')).toBe(true)
  })

  it('returns true for Spanish keyword "explica"', () => {
    expect(detectHeadTalk('Explica cómo funciona este concepto')).toBe(true)
  })

  it('returns true for Spanish keyword "opinión"', () => {
    expect(detectHeadTalk('Mi opinión sobre el mercado actual')).toBe(true)
  })

  it('returns true for Spanish keyword "historia"', () => {
    expect(detectHeadTalk('Historia de cómo construí mi empresa')).toBe(true)
  })

  it('returns true for Spanish keyword "reacciona"', () => {
    expect(detectHeadTalk('Reacciona a este video viral')).toBe(true)
  })

  it('returns false for unrelated cooking content', () => {
    expect(detectHeadTalk('Here is a recipe for chocolate cake')).toBe(false)
  })

  it('returns false for unrelated tutorial content', () => {
    expect(detectHeadTalk('5 tips for better productivity')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(detectHeadTalk('')).toBe(false)
  })

  it('is case-insensitive for English keywords', () => {
    expect(detectHeadTalk('MY UNPOPULAR OPINION')).toBe(true)
    expect(detectHeadTalk('HOT TAKE INCOMING')).toBe(true)
  })

  it('is case-insensitive for Spanish keywords', () => {
    expect(detectHeadTalk('EXPLICA ESTE PROCESO')).toBe(true)
  })
})

// ─── generateTopicHash ─────────────────────────────────────────────

describe('generateTopicHash()', () => {
  it('returns a string of exactly 12 characters', () => {
    const hash = generateTopicHash('Some topic text here')
    expect(hash).toHaveLength(12)
  })

  it('returns only lowercase hex characters (md5 slice)', () => {
    const hash = generateTopicHash('Another topic')
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
  })

  it('is deterministic — same input always produces same hash', () => {
    const input = 'reproducible topic input'
    expect(generateTopicHash(input)).toBe(generateTopicHash(input))
    expect(generateTopicHash(input)).toBe(generateTopicHash(input)) // triple check
  })

  it('normalizes case — "Hello World" equals "hello world"', () => {
    expect(generateTopicHash('Hello World')).toBe(generateTopicHash('hello world'))
  })

  it('normalizes case — "UPPER CASE" equals "upper case"', () => {
    expect(generateTopicHash('UPPER CASE')).toBe(generateTopicHash('upper case'))
  })

  it('strips punctuation — "Hello, World!" equals "Hello World"', () => {
    expect(generateTopicHash('Hello, World!')).toBe(generateTopicHash('Hello World'))
  })

  it('strips punctuation — "topic: about stuff." equals "topic about stuff"', () => {
    expect(generateTopicHash('topic: about stuff.')).toBe(generateTopicHash('topic about stuff'))
  })

  it('produces different hashes for different inputs', () => {
    expect(generateTopicHash('topic A')).not.toBe(generateTopicHash('topic B'))
    expect(generateTopicHash('apple')).not.toBe(generateTopicHash('orange'))
  })

  it('handles single-word input without errors', () => {
    const hash = generateTopicHash('singleword')
    expect(hash).toHaveLength(12)
  })

  it('handles empty string without throwing', () => {
    const hash = generateTopicHash('')
    expect(hash).toHaveLength(12) // md5 of empty string still produces 32-char hex
  })
})
