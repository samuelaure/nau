import { matchesSelection, type SelectionTag } from './engage';

const tags: SelectionTag[] = [
  { dimension: 'context', value: '@casa' },
  { dimension: 'timeAvailable', value: '15min' },
];

describe('matchesSelection', () => {
  it('matches an empty filter unconditionally', () => {
    expect(matchesSelection(tags, {})).toBe(true);
  });

  it('matches when every requested dimension is present with the right value', () => {
    expect(matchesSelection(tags, { context: '@casa' })).toBe(true);
    expect(matchesSelection(tags, { context: '@casa', timeAvailable: '15min' })).toBe(true);
  });

  it('fails when a requested dimension has a different value', () => {
    expect(matchesSelection(tags, { context: '@oficina' })).toBe(false);
  });

  // An item is not "of" a context — it is tagged with one. Absence of the
  // tag altogether is the same failure as a mismatched value.
  it('fails when a requested dimension is entirely absent', () => {
    expect(matchesSelection(tags, { energy: 'alta' })).toBe(false);
  });

  it('requires all requested dimensions to match at once', () => {
    expect(matchesSelection(tags, { context: '@casa', energy: 'alta' })).toBe(false);
  });
});
