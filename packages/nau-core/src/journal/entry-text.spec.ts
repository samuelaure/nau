import { entryText, displayText, editableField, entryEditPatch } from './entry-text'

/**
 * These cases are drawn from real production rows. The voice-note shape is the
 * one that rendered blank in Home for weeks: it carries `raw` and `summary` and
 * has no `text` at all.
 */
const voiceNote = {
  properties: {
    raw: ' Acabo de confirmar de que las notas de voz no se están procesando.',
    summary: 'Acabo de confirmar que las notas de voz no se están procesando.',
    date: '2026-08-24T12:25:34.000Z',
    source: 'zazu_voicenote',
    status: 'published',
  },
}

const webEntry = {
  properties: { text: 'Escrito a mano desde la web', date: '2026-08-24', status: 'published' },
}

describe('entryText — what a summary is built from', () => {
  it('prefers the untouched capture, so no model stands between mic and diary', () => {
    expect(entryText(voiceNote)).toBe(voiceNote.properties.raw)
  })

  it('reads the typed text when that is all there is', () => {
    expect(entryText(webEntry)).toBe('Escrito a mano desde la web')
  })

  it('lets a hand-made correction outrank the original transcription', () => {
    const corrected = {
      properties: {
        raw: 'lo que el microfono oyo',
        summary: 'lo que yo quise decir',
        editedAt: '2026-08-24T13:00:00.000Z',
      },
    }
    expect(entryText(corrected)).toBe('lo que yo quise decir')
  })

  it('never throws on a block with no properties at all', () => {
    expect(entryText({ properties: null })).toBe('')
    expect(entryText({ properties: undefined })).toBe('')
  })

  it('ignores non-string values rather than rendering them', () => {
    expect(entryText({ properties: { raw: 42, summary: 'el bueno' } })).toBe('el bueno')
  })
})

describe('displayText — what goes on screen', () => {
  it('shows the cleaned form, so reading back is not wading through filler', () => {
    expect(displayText(voiceNote)).toBe(voiceNote.properties.summary)
  })

  it('falls back to raw when nothing cleaner exists', () => {
    expect(displayText({ properties: { raw: 'sólo tengo el crudo' } })).toBe('sólo tengo el crudo')
  })

  it('is never empty for an entry that has any text at all', () => {
    // The exact regression: this returned '' and the row rendered blank.
    expect(displayText(voiceNote)).not.toBe('')
  })
})

describe('editableField — where an edit must be written', () => {
  it('corrects the field the entry actually speaks through', () => {
    expect(editableField(voiceNote)).toBe('summary')
    expect(editableField(webEntry)).toBe('text')
  })

  it('stamps editedAt so the summary generator honours the correction', () => {
    const patch = entryEditPatch(voiceNote, 'corregido')
    expect(patch.summary).toBe('corregido')
    expect(patch.editedAt).toEqual(expect.any(String))
  })

  it('leaves raw untouched, because it is the record of what was captured', () => {
    expect(entryEditPatch(voiceNote, 'corregido')).not.toHaveProperty('raw')
  })
})
