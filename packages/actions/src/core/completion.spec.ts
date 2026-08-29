import {
  cancellingOccurrenceEndsRule,
  completionKey,
  statusAt,
  type CompletionRecord,
} from './completion';

describe('an outcome is keyed by item and occurrence together', () => {
  it('pairs the two', () => {
    expect(completionKey('wash-face', '2026-08-29T00:00:00.000Z')).toBe(
      'wash-face@2026-08-29T00:00:00.000Z',
    );
  });

  it('keeps two items at the same occurrence apart', () => {
    const at = '2026-08-29T00:00:00.000Z';
    expect(completionKey('wash-face', at)).not.toBe(completionKey('sweep-floor', at));
  });

  it('keeps one item at two occurrences apart', () => {
    expect(completionKey('wash-face', '2026-08-28T00:00:00.000Z')).not.toBe(
      completionKey('wash-face', '2026-08-29T00:00:00.000Z'),
    );
  });
});

describe('a child inherits its parent calendar, not its parent outcome', () => {
  // The case that fixes the whole design: a daily routine whose child was done
  // today and not yesterday. A single inherited state would make this unsayable.
  const yesterday = '2026-08-28T00:00:00.000Z';
  const today = '2026-08-29T00:00:00.000Z';

  const records: readonly CompletionRecord[] = [
    { itemId: 'wash-face', occurrence: today, outcome: 'done' },
  ];

  it('records the child done at today occurrence', () => {
    expect(statusAt(records, 'wash-face', today)).toBe('done');
  });

  it('leaves the child pending at yesterday occurrence', () => {
    expect(statusAt(records, 'wash-face', yesterday)).toBe('todo');
  });

  // Two children of the same routine, at the same occurrence, with different
  // outcomes — each keeps its own row.
  it('keeps siblings independent within one occurrence', () => {
    const both: readonly CompletionRecord[] = [
      { itemId: 'wash-face', occurrence: today, outcome: 'done' },
      { itemId: 'sweep-floor', occurrence: today, outcome: 'cancelled' },
    ];

    expect(statusAt(both, 'wash-face', today)).toBe('done');
    expect(statusAt(both, 'sweep-floor', today)).toBe('cancelled');
  });

  // The parent's own outcome is a separate record from its children's. Closing
  // the routine does not mark its parts, and marking its parts does not close it.
  it('keeps the parent outcome separate from its children', () => {
    const mixed: readonly CompletionRecord[] = [
      { itemId: 'morning-routine', occurrence: today, outcome: 'done' },
    ];

    expect(statusAt(mixed, 'morning-routine', today)).toBe('done');
    expect(statusAt(mixed, 'wash-face', today)).toBe('todo');
  });
});

describe('absence of a record means pending, not missing', () => {
  it('returns todo when nothing was recorded', () => {
    expect(statusAt([], 'anything', '2026-08-29T00:00:00.000Z')).toBe('todo');
  });
});

describe('cancelling one occurrence does not cancel the rule', () => {
  // Three distinct acts with three distinct consequences, none a substitute for
  // another: cancel the occurrence, bound the recurrence, or delete.
  it('never ends the recurrence', () => {
    expect(cancellingOccurrenceEndsRule()).toBe(false);
  });

  it('leaves a later occurrence of the same item untouched', () => {
    const records: readonly CompletionRecord[] = [
      { itemId: 'take-bins-out', occurrence: '2026-08-29T00:00:00.000Z', outcome: 'cancelled' },
    ];

    expect(statusAt(records, 'take-bins-out', '2026-08-29T00:00:00.000Z')).toBe('cancelled');
    expect(statusAt(records, 'take-bins-out', '2026-08-30T00:00:00.000Z')).toBe('todo');
  });
});
