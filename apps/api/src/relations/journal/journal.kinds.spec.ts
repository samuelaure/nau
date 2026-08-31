import { KindRegistryService } from '../../core/kinds/kind-registry.service';
import { JOURNAL_ENTRY_KIND, JOURNAL_SYNTHESIS_KIND } from '@nau/journal';
import { JOURNAL_KINDS, journalEntryKind } from './journal.kinds';

/**
 * How Journal's domain rules (`@nau/journal`) wire into this api's kind
 * registry. The rules themselves — what a valid entry or synthesis looks
 * like — are tested in `@nau/journal` itself; this is only the registration.
 */
describe('Journal registers against the core registry', () => {
  let registry: KindRegistryService;

  beforeEach(() => {
    registry = new KindRegistryService();
    for (const kind of JOURNAL_KINDS) registry.register(kind);
  });

  it('registers both kinds under the journal namespace', () => {
    expect(registry.ownedBy('journal').map((k) => k.id).sort()).toEqual([
      JOURNAL_ENTRY_KIND,
      JOURNAL_SYNTHESIS_KIND,
    ]);
  });

  it('declares neither kind schedulable — an entry records, it is never due', () => {
    expect(registry.withCapability('schedulable')).toHaveLength(0);
  });

  it('declares only the entry syncable — a synthesis is derived, not captured', () => {
    expect(registry.withCapability('syncable').map((k) => k.id)).toEqual([
      JOURNAL_ENTRY_KIND,
    ]);
  });

  it('validates through the registry, not just the schema directly', () => {
    const liveEntry = {
      text: 'x',
      textOriginal: 'x',
      date: '2026-08-20T18:30:00.000Z',
      source: 'zazu',
      originFormat: 'voice',
    };
    expect(() => registry.validate(JOURNAL_ENTRY_KIND, liveEntry)).not.toThrow();
    expect(() => registry.validate(JOURNAL_ENTRY_KIND, { text: 'only' })).toThrow(
      /textOriginal/,
    );
  });

  it('projects the field Time used to reach for in raw SQL', () => {
    // nau#63: `(properties->>'date')::timestamptz` becomes an indexed column.
    expect(journalEntryKind.projections).toEqual([
      { property: 'date', type: 'timestamptz' },
    ]);
  });
});
