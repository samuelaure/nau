import { isDescendantOf, type Tray } from './tray';

const general: Tray = { id: 'general', parentTrayId: null };
const actions: Tray = { id: 'actions', parentTrayId: 'general' };
const moving: Tray = { id: 'moving-project', parentTrayId: 'actions' };
const trays = [general, actions, moving];

describe('isDescendantOf', () => {
  it('is true for a direct child', () => {
    expect(isDescendantOf(trays, 'actions', 'general')).toBe(true);
  });

  // A project's own tray is a valid tray, nested arbitrarily deep — the
  // whole point of trays being recursive rather than a fixed 3-4 list.
  it('is true transitively, for an arbitrarily nested tray', () => {
    expect(isDescendantOf(trays, 'moving-project', 'general')).toBe(true);
  });

  it('is false for the root itself', () => {
    expect(isDescendantOf(trays, 'general', 'general')).toBe(false);
  });

  it('is false for an unrelated tray', () => {
    expect(isDescendantOf(trays, 'general', 'moving-project')).toBe(false);
  });

  it('is false for an unknown tray id', () => {
    expect(isDescendantOf(trays, 'nonexistent', 'general')).toBe(false);
  });

  // A cycle is a data error, not a case the core should model — this only
  // guards against looping forever if one ever occurs.
  it('does not loop forever on a malformed cycle', () => {
    const cyclic: Tray[] = [
      { id: 'a', parentTrayId: 'b' },
      { id: 'b', parentTrayId: 'a' },
    ];
    expect(isDescendantOf(cyclic, 'a', 'nonexistent')).toBe(false);
  });
});
