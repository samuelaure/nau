import { describe, it, expect } from 'vitest'
import { splitForTelegram } from '../proactive-delivery'

const TELEGRAM_MAX = 4096

describe('splitForTelegram', () => {
  it('leaves a message Telegram already accepts untouched', () => {
    const short = 'Resumen del día.'
    expect(splitForTelegram(short)).toEqual([short])
  })

  it('never emits a chunk Telegram would reject', () => {
    // The real failure: a daily summary carrying the day's entries verbatim.
    const long = 'párrafo de diario. '.repeat(900)
    const chunks = splitForTelegram(long)

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_MAX)
    }
  })

  it('loses no content when splitting', () => {
    const long = Array.from({ length: 400 }, (_, i) => `Entrada número ${i}.`).join('\n\n')
    const rejoined = splitForTelegram(long).join('\n\n')

    // Whitespace at the seams is normalised, so compare on the words.
    expect(rejoined.replace(/\s+/g, ' ').trim()).toBe(long.replace(/\s+/g, ' ').trim())
  })

  it('breaks on a paragraph boundary rather than mid-sentence', () => {
    const paragraph = 'Una experiencia del día que quiero recordar.'
    const long = Array.from({ length: 300 }, () => paragraph).join('\n\n')

    const [first] = splitForTelegram(long)
    // A reader should never be cut off inside a sentence when a paragraph
    // break was available — this is someone's diary being read back.
    expect(first.endsWith('.')).toBe(true)
  })

  it('handles a single unbroken run longer than the limit', () => {
    // No newline anywhere: the hard cut is the only option, and it must still
    // produce chunks Telegram accepts rather than looping or throwing.
    const wall = 'x'.repeat(12000)
    const chunks = splitForTelegram(wall)

    expect(chunks.length).toBeGreaterThan(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_MAX)
    }
    expect(chunks.join('')).toHaveLength(12000)
  })

  it('splits the exact payload that crash-looped the container', () => {
    // 15,669 characters — the length measured on the stuck NotificationQueue row.
    const chunks = splitForTelegram('a'.repeat(15669))
    expect(chunks.every((c) => c.length <= TELEGRAM_MAX)).toBe(true)
  })
})
