import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { KindRegistryService } from './kind-registry.service';
import type { BlockKind, KindCapabilities } from './kind.contract';

/**
 * Kinds invented for the test. Deliberately not any real module's kind — the
 * registry must be demonstrably able to hold kinds it was never written for,
 * which is the whole claim being tested.
 */
const capabilities: KindCapabilities = {
  schedulable: false,
  taggable: true,
  syncable: true,
  nestable: false,
  softDeletable: true,
};

const thing: BlockKind<{ text: string }> = {
  id: 'example.thing',
  schema: z.object({ text: z.string() }),
  capabilities,
};

const chore: BlockKind<{ text: string; done: boolean }> = {
  id: 'sample.chore',
  schema: z.object({ text: z.string(), done: z.boolean() }),
  capabilities: { ...capabilities, schedulable: true },
  projections: [{ property: 'done', type: 'boolean' }],
};

describe('KindRegistryService', () => {
  let registry: KindRegistryService;

  beforeEach(() => {
    registry = new KindRegistryService();
  });

  describe('registration', () => {
    it('starts empty — a system with no modules knows no kinds', () => {
      expect(registry.all()).toEqual([]);
    });

    it('registers a kind and reports it', () => {
      registry.register(thing);
      expect(registry.has('example.thing')).toBe(true);
      expect(registry.all()).toHaveLength(1);
    });

    it('rejects an unnamespaced id, because the owner is part of the identity', () => {
      const orphan = { ...thing, id: 'thing' };
      expect(() => registry.register(orphan)).toThrow(/expected "<owner>\.<name>"/);
    });

    it('rejects a duplicate id — a kind has exactly one owner', () => {
      registry.register(thing);
      expect(() => registry.register({ ...thing })).toThrow(/already registered/);
    });

    it('groups kinds by their owning module', () => {
      registry.register(thing);
      registry.register(chore);
      expect(registry.ownedBy('example').map((k) => k.id)).toEqual(['example.thing']);
      expect(registry.ownedBy('sample').map((k) => k.id)).toEqual(['sample.chore']);
    });
  });

  describe('capabilities are declared, not assumed', () => {
    beforeEach(() => {
      registry.register(thing);
      registry.register(chore);
    });

    it('selects kinds by capability rather than by a hardcoded list of names', () => {
      expect(registry.withCapability('schedulable').map((k) => k.id)).toEqual(['sample.chore']);
      expect(registry.withCapability('taggable')).toHaveLength(2);
    });

    it('includes a kind registered later, without the caller changing', () => {
      expect(registry.withCapability('schedulable')).toHaveLength(1);

      registry.register({ ...thing, id: 'late.arrival', capabilities: { ...capabilities, schedulable: true } });

      expect(registry.withCapability('schedulable').map((k) => k.id)).toEqual([
        'sample.chore',
        'late.arrival',
      ]);
    });

    it('refuses an operation a kind does not declare', () => {
      expect(() => registry.assertCapability('example.thing', 'schedulable')).toThrow(
        BadRequestException,
      );
      expect(() => registry.assertCapability('sample.chore', 'schedulable')).not.toThrow();
    });
  });

  describe('validation', () => {
    beforeEach(() => registry.register(thing));

    it('accepts and returns a valid payload', () => {
      expect(registry.validate('example.thing', { text: 'hello' })).toEqual({ text: 'hello' });
    });

    it('rejects a payload of the wrong shape, naming the offending field', () => {
      expect(() => registry.validate('example.thing', { text: 42 })).toThrow(/text/);
    });

    it('rejects a payload for a kind nobody registered', () => {
      expect(() => registry.validate('ghost.kind', {})).toThrow(/Unknown block kind/);
    });

    it('does not silently accept an unknown kind as a default', () => {
      expect(registry.has('ghost.kind')).toBe(false);
      expect(() => registry.get('ghost.kind')).toThrow(BadRequestException);
    });
  });
});
