/**
 * What each of Journal's kinds can do, declared here rather than assumed by a
 * caller.
 *
 * The shape mirrors `apps/api/src/core/kinds/kind.contract.ts`'s
 * `KindCapabilities`, not by importing it: this package has no dependency on
 * `apps/api`, on purpose — it is meant to run wherever Journal's domain rules
 * are needed, including a device with no server relationship. `relations/
 * api-journal/journal.kinds.ts` is what wires these into the api's kind
 * registry; that wiring is api-shaped and stays there.
 */
export interface JournalKindCapabilities {
  readonly schedulable: boolean;
  readonly taggable: boolean;
  readonly syncable: boolean;
  readonly nestable: boolean;
  readonly softDeletable: boolean;
}

/**
 * An entry records what already happened, so it is never *due*. Declaring
 * `schedulable: false` is what keeps entries off an agenda without the agenda
 * holding a list of which types to exclude.
 *
 * An entry is a leaf (`nestable: false`) — threading replies under an entry
 * would make the capture a container, a different product decision than the
 * one this shape encodes. It syncs to every client, including an offline one.
 */
export const JOURNAL_ENTRY_CAPABILITIES: JournalKindCapabilities = {
  schedulable: false,
  taggable: true,
  syncable: true,
  nestable: false,
  softDeletable: true,
};

/**
 * A synthesis is derived, not captured. `syncable: false` because shipping a
 * copy to a device would ship something regenerable that drifts the moment
 * its sources change — an offline client has no use for a synthesis it did
 * not ask a connected Time to build.
 */
export const JOURNAL_SYNTHESIS_CAPABILITIES: JournalKindCapabilities = {
  schedulable: false,
  taggable: true,
  syncable: false,
  nestable: false,
  softDeletable: true,
};
