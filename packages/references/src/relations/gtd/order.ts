import { clearSuggestion } from '../../core/note';
import type { NoteProperties } from '../../core/schemas';
import type { OrderIntoReferences } from './contract';

/**
 * Executes `OrderIntoReferences`: the note's own properties with
 * `suggestedType` cleared.
 *
 * Unlike `orderIntoActions`/`orderIntoJournal`, this function does not build
 * a foreign kind's shape — References is the item's kind already (nau#111),
 * so ordering here has exactly one job: end the pending suggestion that was
 * only ever a hint for processing, never authoritative. `clearSuggestion`
 * already existed in `../../core/note.ts` before this relation was
 * confirmed; this is the seam that makes it the answer to `order`, not a
 * new rule.
 *
 * Takes the note's own existing properties rather than reading anything
 * itself — this package has no persistence layer, same discipline
 * `orderIntoActions`/`orderIntoJournal` apply. The caller (GTD's own
 * `(GTD)·(References)` relation, or `apps/api` on its behalf) reads the
 * block and writes the result back — `properties` only, `type` unchanged.
 */
export function orderIntoReferences(
  _order: OrderIntoReferences,
  existing: NoteProperties,
): NoteProperties {
  return clearSuggestion(existing);
}
