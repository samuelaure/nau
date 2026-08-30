import { orderIntoJournal } from './order';
import { InvalidJournalEntryError } from '../../entry';

const existingNote = {
  text: 'lo que capturé',
  textOriginal: 'lo que capturé',
  source: 'zazu',
  originFormat: 'voice',
  sourceId: 'voicenote-123',
  date: '2026-08-20T09:00:00.000Z',
};

describe('orderIntoJournal', () => {
  it('converts the existing note rather than building from scratch', () => {
    const properties = orderIntoJournal({ blockId: 'blk-1' }, existingNote);

    expect(properties.text).toBe('lo que capturé');
    expect(properties.source).toBe('zazu');
    expect(properties.originFormat).toBe('voice');
  });

  it('keeps the sourceId the note already carried', () => {
    const properties = orderIntoJournal({ blockId: 'blk-1' }, existingNote);
    expect(properties.sourceId).toBe('voicenote-123');
  });

  it('applies a text correction from the order when GTD processing changed it', () => {
    const properties = orderIntoJournal(
      { blockId: 'blk-1', text: 'texto corregido durante el proceso' },
      existingNote,
    );
    expect(properties.text).toBe('texto corregido durante el proceso');
    // textOriginal is unaffected by the order's correction — it is still
    // what the note said when it was first captured.
    expect(properties.textOriginal).toBe('lo que capturé');
  });

  it('falls back to the date the note already carried', () => {
    const properties = orderIntoJournal({ blockId: 'blk-1' }, existingNote);
    expect(properties.date).toBe('2026-08-20T09:00:00.000Z');
  });

  it('lets the order override capturedAt explicitly', () => {
    const properties = orderIntoJournal(
      { blockId: 'blk-1', capturedAt: '2026-08-21T10:00:00.000Z' },
      existingNote,
    );
    expect(properties.date).toBe('2026-08-21T10:00:00.000Z');
  });

  it('lets the order override source/originFormat explicitly', () => {
    const properties = orderIntoJournal(
      { blockId: 'blk-1', source: 'app', originFormat: 'text' },
      existingNote,
    );
    expect(properties.source).toBe('app');
    expect(properties.originFormat).toBe('text');
  });

  it('refuses to order a note that carries no source/originFormat at all', () => {
    const bareNote = { text: 'x' };
    expect(() => orderIntoJournal({ blockId: 'blk-1' }, bareNote)).toThrow(
      InvalidJournalEntryError,
    );
  });

  it('rejects a note with no text anywhere', () => {
    expect(() =>
      orderIntoJournal({ blockId: 'blk-1' }, { source: 'zazu', originFormat: 'voice' }),
    ).toThrow(InvalidJournalEntryError);
  });
});
