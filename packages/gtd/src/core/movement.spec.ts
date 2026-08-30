import { currentTray, isOrdered, membershipOf, type Movement } from './movement';

const at = (n: number) => `2026-08-${String(n).padStart(2, '0')}T00:00:00Z`;

describe('currentTray', () => {
  it('is null before any movement', () => {
    expect(currentTray([], 'item-1')).toBeNull();
  });

  it('is the general tray right after capture', () => {
    const movements: Movement[] = [
      { itemId: 'item-1', kind: 'capture', from: null, to: 'general', at: at(1) },
    ];
    expect(currentTray(movements, 'item-1')).toBe('general');
  });

  it('follows the chain of processing through secondary trays', () => {
    const movements: Movement[] = [
      { itemId: 'item-1', kind: 'capture', from: null, to: 'general', at: at(1) },
      { itemId: 'item-1', kind: 'process', from: 'general', to: 'actions', at: at(2) },
      { itemId: 'item-1', kind: 'process', from: 'actions', to: 'moving-project', at: at(3) },
    ];
    expect(currentTray(movements, 'item-1')).toBe('moving-project');
  });

  it('is null once the item has been ordered — it left every tray', () => {
    const movements: Movement[] = [
      { itemId: 'item-1', kind: 'capture', from: null, to: 'general', at: at(1) },
      { itemId: 'item-1', kind: 'order', from: 'general', to: null, at: at(2) },
    ];
    expect(currentTray(movements, 'item-1')).toBeNull();
  });

  it('only looks at movements for the given item', () => {
    const movements: Movement[] = [
      { itemId: 'item-1', kind: 'capture', from: null, to: 'general', at: at(1) },
      { itemId: 'item-2', kind: 'capture', from: null, to: 'inbox-2', at: at(1) },
    ];
    expect(currentTray(movements, 'item-1')).toBe('general');
    expect(currentTray(movements, 'item-2')).toBe('inbox-2');
  });
});

describe('isOrdered', () => {
  it('is false with no movements', () => {
    expect(isOrdered([], 'item-1')).toBe(false);
  });

  it('is false while still in a tray', () => {
    const movements: Movement[] = [
      { itemId: 'item-1', kind: 'capture', from: null, to: 'general', at: at(1) },
    ];
    expect(isOrdered(movements, 'item-1')).toBe(false);
  });

  it('is true exactly when the last movement is an order', () => {
    const movements: Movement[] = [
      { itemId: 'item-1', kind: 'capture', from: null, to: 'general', at: at(1) },
      { itemId: 'item-1', kind: 'order', from: 'general', to: null, at: at(2) },
    ];
    expect(isOrdered(movements, 'item-1')).toBe(true);
  });
});

describe('membershipOf', () => {
  it('is null once ordered', () => {
    const movements: Movement[] = [
      { itemId: 'item-1', kind: 'capture', from: null, to: 'general', at: at(1) },
      { itemId: 'item-1', kind: 'order', from: 'general', to: null, at: at(2) },
    ];
    expect(membershipOf(movements, 'item-1')).toBeNull();
  });

  it('reflects the current tray while in transit', () => {
    const movements: Movement[] = [
      { itemId: 'item-1', kind: 'capture', from: null, to: 'general', at: at(1) },
    ];
    expect(membershipOf(movements, 'item-1')).toEqual({ trayId: 'general', itemId: 'item-1' });
  });
});
