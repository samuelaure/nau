/**
 * What `references.note` can do, declared here rather than assumed by a
 * caller.
 *
 * The shape mirrors `apps/api/src/core/kinds/kind.contract.ts`'s
 * `KindCapabilities`, not by importing it: this package has no dependency on
 * `apps/api`, on purpose — it is meant to run wherever References' domain
 * rules are needed, including a device with no server relationship (per
 * nau-mobile's local-first requirement). `relations/api-references/notes.kinds.ts`
 * is what wires this into the api's kind registry; that wiring is api-shaped
 * and stays there.
 */
export interface ReferencesKindCapabilities {
  readonly schedulable: boolean;
  readonly taggable: boolean;
  readonly syncable: boolean;
  readonly nestable: boolean;
  readonly softDeletable: boolean;
}

/**
 * A note never carries its own plan - a review reminder is a real Actions
 * item referencing the note (`ReviewIntent`, see `review-intent.ts`), never a
 * date stored on the note itself. `schedulable: false` prevents Time's agenda
 * from trying to query the note for dates that actually live in Actions.
 * The note is located via the Actions item's relation, not by its own schedule.
 *
 * `nestable: true` because a note may belong to a `Collection`, using the
 * same block tree every other nestable kind uses — References does not
 * invent a second hierarchy mechanism. `syncable: true` because nau-mobile
 * captures notes today and will keep doing so through its own rebuild.
 */
export const REFERENCES_NOTE_CAPABILITIES: ReferencesKindCapabilities = {
  schedulable: false,
  taggable: true,
  syncable: true,
  nestable: true,
  softDeletable: true,
};
