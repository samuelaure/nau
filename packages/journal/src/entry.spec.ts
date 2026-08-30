import { applyEdit, buildConvertedEntry, buildNewEntry, InvalidJournalEntryError } from './entry';

describe('buildNewEntry', () => {
  it('mirrors text into textOriginal on creation', () => {
    const entry = buildNewEntry({ text: 'lo que dije', source: 'zazu', originFormat: 'voice' });
    expect(entry.text).toBe('lo que dije');
    expect(entry.textOriginal).toBe('lo que dije');
  });

  it('defaults date to now when the caller has no better answer', () => {
    const before = Date.now();
    const entry = buildNewEntry({ text: 'x', source: 'app', originFormat: 'text' });
    expect(new Date(entry.date).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('keeps a caller-supplied date, so a late-processed capture keeps the day it was lived', () => {
    const entry = buildNewEntry({
      text: 'x',
      date: '2026-08-20T23:50:00.000Z',
      source: 'zazu',
      originFormat: 'voice',
    });
    expect(entry.date).toBe('2026-08-20T23:50:00.000Z');
  });

  it('carries an opaque reference to the capture, without ever asking what it is', () => {
    const entry = buildNewEntry({
      text: 'x',
      source: 'zazu',
      originFormat: 'voice',
      sourceId: 'capture-9',
    });
    expect(entry.sourceId).toBe('capture-9');
  });

  it('refuses an empty entry', () => {
    expect(() => buildNewEntry({ text: '   ', source: 'app', originFormat: 'text' })).toThrow(
      InvalidJournalEntryError,
    );
  });
});

describe('applyEdit', () => {
  const original = buildNewEntry({ text: 'lo que dije primero', source: 'app', originFormat: 'text' });

  it('changes text and leaves textOriginal untouched', () => {
    const edited = applyEdit({ current: original, text: 'lo que quise decir' });
    expect(edited.text).toBe('lo que quise decir');
    expect(edited.textOriginal).toBe('lo que dije primero');
  });

  it('stamps editedAt', () => {
    const edited = applyEdit({ current: original, text: 'corregido' });
    expect(typeof edited.editedAt).toBe('string');
  });

  it('refuses to edit an entry down to nothing', () => {
    expect(() => applyEdit({ current: original, text: '  ' })).toThrow(InvalidJournalEntryError);
  });

  it('re-editing does not move textOriginal a second time', () => {
    const first = applyEdit({ current: original, text: 'primera corrección' });
    const second = applyEdit({ current: first, text: 'segunda corrección' });
    expect(second.textOriginal).toBe('lo que dije primero');
  });
});

describe('buildConvertedEntry', () => {
  it('takes the capture text when none is supplied explicitly', () => {
    const entry = buildConvertedEntry({
      existing: { text: 'lo capturado', date: '2026-08-20T09:00:00.000Z' },
      source: 'zazu',
      originFormat: 'voice',
    });
    expect(entry.text).toBe('lo capturado');
    expect(entry.date).toBe('2026-08-20T09:00:00.000Z');
  });

  it('keeps the existing textOriginal rather than overwriting it with the new text', () => {
    const entry = buildConvertedEntry({
      existing: { text: 'x', textOriginal: 'la version original' },
      source: 'zazu',
      originFormat: 'voice',
    });
    expect(entry.textOriginal).toBe('la version original');
  });

  it('refuses a capture with no text anywhere', () => {
    expect(() =>
      buildConvertedEntry({ existing: {}, source: 'zazu', originFormat: 'voice' }),
    ).toThrow(InvalidJournalEntryError);
  });

  it('carries the existing sourceId through, unexamined', () => {
    const entry = buildConvertedEntry({
      existing: { text: 'x', sourceId: 'capture-42' },
      source: 'zazu',
      originFormat: 'voice',
    });
    expect(entry.sourceId).toBe('capture-42');
  });
});
