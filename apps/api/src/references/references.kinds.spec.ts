import { KindRegistryService } from '../core/kinds/kind-registry.service';
import { REFERENCES_NOTE_KIND } from '@nau/references';
import { REFERENCES_KINDS, referencesNoteKind } from './references.kinds';

/**
 * How References' domain rules (`@nau/references`) wire into this api's kind
 * registry. The rules themselves — what a valid note looks like — are tested
 * in `@nau/references` itself; this is only the registration.
 */
describe('References registers against the core registry', () => {
  let registry: KindRegistryService;

  beforeEach(() => {
    registry = new KindRegistryService();
    for (const kind of REFERENCES_KINDS) registry.register(kind);
  });

  it('registers a single kind under the references namespace', () => {
    expect(registry.ownedBy('references').map((k) => k.id)).toEqual([REFERENCES_NOTE_KIND]);
  });

  it('does not declare the kind schedulable — a review reminder is a real Actions item, never a date on the note', () => {
    expect(registry.withCapability('schedulable').map((k) => k.id)).toEqual([]);
  });

  it('declares the kind syncable — nau-mobile captures notes today', () => {
    expect(registry.withCapability('syncable').map((k) => k.id)).toEqual([
      REFERENCES_NOTE_KIND,
    ]);
  });

  it('declares the kind nestable — collections use the shared block tree', () => {
    expect(registry.withCapability('nestable').map((k) => k.id)).toEqual([
      REFERENCES_NOTE_KIND,
    ]);
  });

  it('validates through the registry, not just the schema directly', () => {
    expect(() => registry.validate(REFERENCES_NOTE_KIND, { content: 'x' })).not.toThrow();
    expect(() => registry.validate(REFERENCES_NOTE_KIND, { content: 42 })).toThrow();
  });

  it('projects only title — content and attachments stay unprojected rich content', () => {
    expect(referencesNoteKind.projections).toEqual([{ property: 'title', type: 'text' }]);
  });
});
