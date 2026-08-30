import type { NoteProperties } from '../../core/schemas';

/**
 * `(References)·(GTD)` — the operation GTD invokes when a tray item is
 * confirmed as References' own, rather than routed elsewhere.
 *
 * **Confirms the draft published from `packages/gtd`**
 * (`packages/gtd/src/relations/references/contract.ts`, per nau#117), with
 * one addition beyond what the draft assumed and no changes to what it
 * already got right.
 *
 * What the draft got right, confirmed as-is:
 *
 *   - **`blockId`, not `noteId`.** Same correction `(GTD)·(Actions)`
 *     (nau#114) and `(GTD)·(Journal)` (nau#115) each applied to their own
 *     first drafts. Adopted here too, for the same reason.
 *   - **No kind mutation.** Per nau#111, every capture is already born as
 *     `references.note` — there is no separate references-tray kind to
 *     convert *from*. Ordering "into References" only ends the item's time
 *     in a tray; the block's `type` never changes.
 *   - **References as default destination.** A segment the triage cannot
 *     confidently route elsewhere simply stays `references.note` — this is
 *     the one destination that never needs a `suggestedType` at all to be
 *     correct, which is exactly why `order` here has nothing to build.
 *
 * §8 point 1, answered directly (nau#117's central question): **`suggestedType`
 * lives as a property of the note**, not as a field on `TrayMembership`.
 * `@nau/references`' own `NoteSchema` already declares it
 * (`packages/references/src/core/schemas.ts`, citing nau#111/nau#112) and
 * `clearSuggestion` (`note.ts`) already exists to clear it. This was
 * implemented before nau#117 asked the question explicitly — the code
 * answered it first; this contract is what makes that answer official
 * rather than merely de facto.
 *
 * The one addition: `OrderIntoReferences` needs an explicit signal for
 * *when* to clear `suggestedType`, because "no further orders are coming"
 * is not observable from inside this pure package — only the caller (GTD's
 * own `(GTD)·(References)` relation, or `apps/api` on its behalf) knows a
 * tray item's processing has actually concluded.
 */
export interface OrderIntoReferences {
  /** The block already sitting in a tray, confirmed as References' own. */
  readonly blockId: string;
}

/**
 * `noteId` is the same id as `OrderIntoReferences.blockId` — ordering never
 * creates a new block here (there is nothing to mutate into), it only ends
 * tray membership and clears the pending suggestion. Kept as its own field,
 * same reasoning as `OrderedIntoActions`/`OrderedIntoJournal`, so a caller
 * reading only the result doesn't have to know that fact to get the id
 * right.
 */
export interface OrderedIntoReferences {
  readonly noteId: string;
}

/**
 * What ordering into References produces: the note's own properties with
 * `suggestedType` cleared — restated here so callers importing only the
 * contract (not `order.ts`) still see the real return shape, same pattern
 * `(GTD)·(Actions)`'s `OrderedActionProperties` follows.
 */
export type OrderedNoteProperties = NoteProperties;
