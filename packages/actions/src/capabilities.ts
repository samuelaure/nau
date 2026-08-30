/**
 * What Actions' one kind can do, declared here rather than assumed by a
 * caller.
 *
 * The shape mirrors `apps/api/src/core/kinds/kind.contract.ts`'s
 * `KindCapabilities`, not by importing it — same reasoning as
 * `@nau/journal`'s and `@nau/references`'s: this package has no dependency on
 * `apps/api`, on purpose, so it runs wherever an actionable item's rules are
 * needed, including a device with no server relationship.
 * `relations/api-actions/actions.kinds.ts` wires this into the api's kind
 * registry; that wiring is api-shaped and stays there.
 */
export interface ActionsKindCapabilities {
  readonly schedulable: boolean;
  readonly taggable: boolean;
  readonly syncable: boolean;
  readonly nestable: boolean;
  readonly softDeletable: boolean;
}

/**
 * `schedulable: true` replaces `AGENDA_TYPES` (nau#64) — the agenda asks
 * which kinds declare themselves schedulable instead of holding a hardcoded
 * list of other modules' types.
 *
 * `nestable: true` is what lets one kind cover all four shapes
 * (`core/shape.ts`): a project or routine is simply an item that has
 * children, never a different kind.
 */
export const ACTIONS_ITEM_CAPABILITIES: ActionsKindCapabilities = {
  schedulable: true,
  taggable: true,
  syncable: true,
  nestable: true,
  softDeletable: true,
};
