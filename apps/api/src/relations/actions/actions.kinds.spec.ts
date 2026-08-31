import { KindRegistryService } from '../../core/kinds/kind-registry.service';
import { ACTIONS_ITEM_KIND } from '@nau/actions';
import { ACTIONS_KINDS, actionsItemKind } from './actions.kinds';

/**
 * How Actions' domain rules (`@nau/actions`) wire into this api's kind
 * registry. The rules themselves — what a valid item looks like, the two
 * derived axes — are tested in `@nau/actions` itself; this is only the
 * registration.
 */
describe('Actions registers against the core registry', () => {
  let registry: KindRegistryService;

  beforeEach(() => {
    registry = new KindRegistryService();
    for (const kind of ACTIONS_KINDS) registry.register(kind);
  });

  it('registers a single kind under the actions namespace', () => {
    expect(registry.ownedBy('actions').map((k) => k.id)).toEqual([ACTIONS_ITEM_KIND]);
  });

  it('declares the kind schedulable — replaces AGENDA_TYPES (nau#64)', () => {
    expect(registry.withCapability('schedulable').map((k) => k.id)).toEqual([
      ACTIONS_ITEM_KIND,
    ]);
  });

  it('declares the kind nestable — a project or routine is an item with children, never a different kind', () => {
    expect(registry.withCapability('nestable').map((k) => k.id)).toEqual([
      ACTIONS_ITEM_KIND,
    ]);
  });

  it('validates through the registry, not just the schema directly', () => {
    expect(() => registry.validate(ACTIONS_ITEM_KIND, { text: 'x' })).not.toThrow();
    expect(() => registry.validate(ACTIONS_ITEM_KIND, { status: 'inbox' })).toThrow();
  });

  it('projects only status — the field the agenda, next-actions and the tray all filter by', () => {
    expect(actionsItemKind.projections).toEqual([{ property: 'status', type: 'text' }]);
  });
});
