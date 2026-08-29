import type { TimeSystem } from './contract';
import { SystemRegistry } from './registry';

const stub = (id: string): TimeSystem => ({
  id,
  name: id,
  scales: [{ id: 'unit', name: 'Unit', typicalMs: 1000 }],
  capabilities: { projects: true, cost: 'arithmetic', concurrent: false, openEnded: false },
  periodAt: () => null,
  periodsIn: () => [],
  occurrences: () => [],
});

describe('SystemRegistry', () => {
  it('finds a registered system', () => {
    const registry = new SystemRegistry([stub('gregorian')]);
    expect(registry.get('gregorian').id).toBe('gregorian');
  });

  it('returns null for an unregistered system rather than throwing', () => {
    expect(new SystemRegistry().find('nau')).toBeNull();
  });

  // A stored Planning naming a system with no implementation is a wrong caller,
  // not incomplete data — so `get` names what was asked for instead of failing
  // somewhere further down as an undefined access.
  it('throws from get, naming the system asked for', () => {
    expect(() => new SystemRegistry().get('nau')).toThrow('Unknown time system: "nau"');
  });

  it('refuses a duplicate registration', () => {
    const registry = new SystemRegistry([stub('gregorian')]);
    expect(() => registry.register(stub('gregorian'))).toThrow(/already registered/);
  });

  describe('scale lookup', () => {
    const registry = new SystemRegistry([stub('gregorian')]);

    it('resolves a scale by the pair that identifies it', () => {
      expect(registry.scale('gregorian', 'unit')?.typicalMs).toBe(1000);
    });

    it('returns null when the scale is not in that system', () => {
      expect(registry.scale('gregorian', 'lunation')).toBeNull();
    });

    // The property that makes ScaleRef worth carrying: a scale id alone is
    // meaningless, and the same id in another system is a different scale.
    it('returns null when the system is unknown, even for a known scale id', () => {
      expect(registry.scale('nau', 'unit')).toBeNull();
    });
  });
});
