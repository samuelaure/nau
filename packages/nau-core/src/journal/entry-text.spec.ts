import { entryText, displayText, entryEditPatch } from './entry-text'

/**
 * An entry holds one text field.
 *
 * These tests used to enumerate which of `raw`, `summary` and `text` won under
 * which conditions — the rule three separate readers each implemented slightly
 * differently, which is how voice-captured entries came to render as blank rows
 * on the home screen. There is no rule left to test; what remains is that the
 * one field is read, and that an edit never touches the record of what the
 * entry said first.
 */

const entry = (properties: Record<string, unknown>) => ({ properties })

describe('entryText', () => {
  it('reads the entry text', () => {
    expect(entryText(entry({ text: 'lo que viví' }))).toBe('lo que viví')
  })

  it('never falls back to the pre-edit version', () => {
    // `textOriginal` is provenance, not content. Showing it when `text` is
    // empty would resurrect writing the person deliberately cleared.
    expect(entryText(entry({ text: '', textOriginal: 'lo que dije al principio' }))).toBe('')
  })

  it('survives a block with no properties at all', () => {
    expect(entryText({ properties: null })).toBe('')
    expect(entryText({ properties: undefined })).toBe('')
  })

  it('ignores a non-string in the text field', () => {
    expect(entryText(entry({ text: 42 }))).toBe('')
  })
})

describe('displayText', () => {
  it('shows what the entry says', () => {
    expect(displayText(entry({ text: 'lo que viví' }))).toBe('lo que viví')
  })
})

describe('entryEditPatch', () => {
  it('writes the correction to the field the entry speaks through', () => {
    const patch = entryEditPatch(entry({ text: 'antes' }), 'después')
    expect(patch.text).toBe('después')
  })

  it('leaves the original untouched', () => {
    const patch = entryEditPatch(entry({ text: 'antes', textOriginal: 'antes' }), 'después')
    // The only evidence that an entry was changed is that these two differ.
    expect(patch.textOriginal).toBeUndefined()
  })

  it('stamps when the correction happened', () => {
    const patch = entryEditPatch(entry({ text: 'antes' }), 'después')
    expect(typeof patch.editedAt).toBe('string')
  })
})
