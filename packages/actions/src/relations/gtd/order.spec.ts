import { orderIntoActions } from './order';

const existingNote = {
  text: 'llamar a la empresa de mudanzas',
  content: 'llamar a la empresa de mudanzas',
  suggestedType: 'action',
};

describe('orderIntoActions', () => {
  it('converts the existing note rather than building from scratch', () => {
    const properties = orderIntoActions({ blockId: 'blk-1' }, existingNote);
    expect(properties.text).toBe('llamar a la empresa de mudanzas');
  });

  it('falls back to content when the note carries no text field', () => {
    const properties = orderIntoActions(
      { blockId: 'blk-1' },
      { content: 'empaquetar libros' },
    );
    expect(properties.text).toBe('empaquetar libros');
  });

  it('is honest about an item with no words yet, rather than refusing it', () => {
    const properties = orderIntoActions({ blockId: 'blk-1' }, {});
    expect(properties.text).toBe('');
  });

  it('applies a text correction from the order when GTD processing changed it', () => {
    const properties = orderIntoActions(
      { blockId: 'blk-1', text: 'texto corregido durante el proceso' },
      existingNote,
    );
    expect(properties.text).toBe('texto corregido durante el proceso');
  });

  // Ordering is not completing — an item does not arrive half-done because it
  // took a while to leave the tray.
  it('always starts todo, regardless of what the note carried', () => {
    const properties = orderIntoActions(
      { blockId: 'blk-1' },
      { ...existingNote, status: 'done' },
    );
    expect(properties.status).toBe('todo');
  });

  it('carries priority and deadline when the order sets them', () => {
    const properties = orderIntoActions(
      { blockId: 'blk-1', priority: 'high', deadline: '2026-09-01T00:00:00.000Z' },
      existingNote,
    );
    expect(properties.priority).toBe('high');
    expect(properties.deadline).toBe('2026-09-01T00:00:00.000Z');
  });

  it('defaults priority and deadline to null when the order omits them', () => {
    const properties = orderIntoActions({ blockId: 'blk-1' }, existingNote);
    expect(properties.priority).toBeNull();
    expect(properties.deadline).toBeNull();
  });

  // suggestedType is GTD's pre-typing on the note in transit (nau#111); once
  // ordered the item is an actions.item for real, and the schema's own
  // passthrough carries the field through harmlessly rather than this
  // function having an opinion on stripping it.
  it('does not choke on suggestedType left over from the tray', () => {
    expect(() => orderIntoActions({ blockId: 'blk-1' }, existingNote)).not.toThrow();
  });
});
