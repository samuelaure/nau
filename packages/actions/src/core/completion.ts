import type { Outcome, Status } from './contract';

/**
 * Recording that something was attended to, and against which occurrence.
 *
 * The distinction this file exists to keep straight:
 *
 * |            | who generates it | who records against it          |
 * |------------|------------------|---------------------------------|
 * | occurrence | the parent's plan| —                               |
 * | outcome    | —                | each item separately            |
 *
 * A child without a plan of its own **does not inherit its parent's outcome.
 * It inherits its calendar.** The parent's occurrence is the shared temporal
 * axis: the instant both record against, each one its own, in independent
 * entries.
 *
 * The case that fixes it: a daily routine; today I washed my face, yesterday I
 * did not. Yesterday's occurrence carries no entry for that child, today's
 * does. A single inherited state would make that unsayable, and the history of
 * a routine's parts is exactly what one wants to be able to read back.
 */

/**
 * The instant an occurrence was predicted for, as an opaque value.
 *
 * A string rather than a date because the core has no business parsing it: it
 * is an identifier produced by a time system, and the only operation the core
 * performs on it is equality. Treating it as a date would invite arithmetic,
 * and arithmetic on instants is Time's, not Actions'.
 */
export type OccurrenceKey = string;

/**
 * One recorded outcome, against one occurrence.
 *
 * `itemId` is the item that was attended to — which for a child of a routine is
 * the child, never the parent, even though the occurrence came from the parent.
 */
export interface CompletionRecord {
  readonly itemId: string;
  readonly occurrence: OccurrenceKey;
  readonly outcome: Outcome;
}

/**
 * The key an outcome is recorded under.
 *
 * `(item, occurrence)` — and for a child governed by its parent, the occurrence
 * is the parent's. That pairing is what gives each child its own history along
 * a calendar it does not own.
 *
 * Recorded against the instant the rule predicted, never the moment of ticking:
 * otherwise catching up on yesterday's habit would mark it done today, and the
 * record would describe the wrong days.
 */
export function completionKey(itemId: string, occurrence: OccurrenceKey): string {
  return `${itemId}@${occurrence}`;
}

/**
 * The status implied by a set of records, for one item at one occurrence.
 *
 * Absence is `todo` rather than an error: nothing recorded means nothing has
 * happened yet, which is a state and not a gap.
 */
export function statusAt(
  records: readonly CompletionRecord[],
  itemId: string,
  occurrence: OccurrenceKey,
): Status {
  const key = completionKey(itemId, occurrence);
  const match = records.find((r) => completionKey(r.itemId, r.occurrence) === key);
  return match ? match.outcome : 'todo';
}

/**
 * Whether cancelling this occurrence should stop the rule.
 *
 * Always false, and it is a deliberate answer rather than a stub. Cancelling
 * one occurrence does not cancel the recurrence: the three levels are distinct
 * acts with distinct consequences, and none substitutes for another.
 *
 *   - not this time      → cancel the occurrence
 *   - never again        → bound the recurrence (its end)
 *   - as if it never was → delete
 *
 * Cancelling today's "take the bins out" must not touch tomorrow's. The
 * function exists so that the rule is stated in code and covered by a test,
 * rather than living only in a comment somebody can forget.
 */
export function cancellingOccurrenceEndsRule(): boolean {
  return false;
}
