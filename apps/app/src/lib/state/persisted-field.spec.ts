import { readPersisted } from './persisted-field'

describe('readPersisted', () => {
  const isGridOrList = (v: string): v is 'grid' | 'list' => v === 'grid' || v === 'list'

  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the fallback when nothing is stored', () => {
    expect(readPersisted('missing-key', isGridOrList, 'grid')).toBe('grid')
  })

  it('returns the stored value when it validates', () => {
    localStorage.setItem('k', 'list')
    expect(readPersisted('k', isGridOrList, 'grid')).toBe('list')
  })

  it('returns the fallback when the stored value fails validation — this is the bug the shared helper fixes', () => {
    // workspace-store's hand-rolled hydration used to skip this check
    // entirely, trusting whatever localStorage held verbatim — garbage in
    // (a stale value from a since-removed enum member, manual tampering)
    // went straight into state.
    localStorage.setItem('k', 'garbage')
    expect(readPersisted('k', isGridOrList, 'grid')).toBe('grid')
  })

  it('returns the fallback on the server (no window)', () => {
    const original = global.window
    // @ts-expect-error simulating SSR
    delete global.window
    expect(readPersisted('k', isGridOrList, 'grid')).toBe('grid')
    global.window = original
  })
})
