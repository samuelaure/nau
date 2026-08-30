/**
 * `(GTD)·(Zazŭ)` — the triage as a consumer of whichever relations are
 * active, per nau#112.
 *
 * The `order` payload shapes it composes are no longer this package's own
 * invention: `relations/actions/contract.ts`, `relations/journal/contract.ts`
 * and `relations/references/contract.ts` all re-export the real, confirmed
 * contracts — `@nau/actions/relations/gtd`, `@nau/journal/relations/gtd`,
 * `@nau/references/relations/gtd` — published per nau#114, nau#115 and
 * nau#117 respectively. All three sides converged before this file was
 * wired into `apps/api` (nau#118).
 *
 * The point nau#112 exists to fix: the triage must not know Actions,
 * References and Journal by name inside one class. Here, it knows only that
 * a `Destination` exists and asks the registry which ones are currently
 * wired — so switching a relation off (e.g. deactivating
 * `relations/journal/`) removes that destination from what the triage can
 * suggest, with no change to this file or to the LLM prompt.
 *
 * What still belongs to `apps/api/src/relations/api-gtd/` and not here:
 * the actual LLM call, the transcription hand-off from Zazŭ, and wiring the
 * real `order*` functions (`orderIntoActions`, `orderIntoJournal` — both
 * real and callable today, per `relations/actions/` and
 * `relations/journal/`) into this registry as live `DestinationHandler`s.
 * This file only defines the shape of that composition — pure, so it can be
 * exercised without a running LLM or a database.
 */

/** The destinations a segment can be routed toward, as GTD sees them. */
export type Destination = 'actions' | 'references' | 'journal';

/**
 * A segment the triage extracted from a voice capture, pre-typed but not
 * yet confirmed. `suggestedType` names a `Destination` — never a foreign
 * module's own kind id, which keeps this file from having to know
 * `actions.item` exists any more than the core does.
 */
export interface TriagedSegment {
  readonly text: string;
  readonly suggestedDestination: Destination | null;
}

/**
 * What a relation registers to make itself a valid triage destination.
 * `available` lets a relation withdraw itself at runtime (e.g. no brand
 * configured for a content-routing case elsewhere in the system uses this
 * same pattern) without being unregistered outright.
 */
export interface DestinationHandler {
  readonly destination: Destination;
  readonly available: () => boolean;
}

/**
 * The destinations the triage may currently suggest — exactly the
 * registered handlers that report themselves available. Deactivating
 * `relations/journal/` (per the blueprint's worked example) removes
 * `'journal'` from this list with no change here and no change to whatever
 * prompt `relations/zazu/`'s LLM call uses to build `suggestedDestination`.
 */
export function activeDestinations(handlers: readonly DestinationHandler[]): Destination[] {
  return handlers.filter((h) => h.available()).map((h) => h.destination);
}

/**
 * Whether a segment's suggestion still points at something the system can
 * currently act on. A relation deactivated after a segment was produced
 * (or a stale suggestion) should not silently pretend to route — the
 * caller falls back to leaving the note as `references.note`, which is
 * always safe per `relations/references/`'s default-destination role.
 */
export function isRoutable(
  segment: TriagedSegment,
  handlers: readonly DestinationHandler[],
): boolean {
  if (!segment.suggestedDestination) return false;
  return activeDestinations(handlers).includes(segment.suggestedDestination);
}
