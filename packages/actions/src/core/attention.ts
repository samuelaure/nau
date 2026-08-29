import type { ActionItem } from './contract';

/**
 * Whether an item is still asking to be attended to.
 *
 * The rule, whole:
 *
 *   **An overdue item carries forward until something replaces it. What can
 *   replace it is its own outcome — done or cancelled — its next occurrence, or
 *   its rescheduling.**
 *
 * Carry-over is not a reminder to *complete* something; it is a reminder to
 * *attend* to it. It does not measure "has this been done?" but "has this been
 * resolved in some way?". Rescheduling resolves: deciding a new when is
 * attending to the item, even though nothing was executed. An item that kept
 * carrying forward after being rescheduled would be demanding attention it has
 * already received.
 *
 * The three replacements are not three branches. They are three ways for the
 * overdue condition to stop holding — which is why the implementation below
 * asks one question and not three:
 *
 * - rescheduling writes a plan whose period has not elapsed, so it is no longer
 *   overdue;
 * - the next occurrence displaces the previous one;
 * - an outcome removes the item from what is pending at all.
 */

/**
 * The facts the core needs, all of them already answered by somebody else.
 *
 * Deliberately abstract. Whether a period has elapsed is Time's arithmetic;
 * whether a later occurrence exists is Time's projection. The core only
 * combines the answers, which is what lets it run with Time switched off.
 */
export interface AttentionFacts {
  /** Whether the period this item was placed in has already elapsed. */
  readonly overdue: boolean;
  /**
   * Whether a later occurrence of the same rule exists and has already arrived.
   *
   * For a rule that counts from completion this is always false, and not for
   * lack of data: such a rule has no next occurrence until the current one is
   * completed. See the note on unbounded carry-over below.
   */
  readonly laterOccurrenceArrived: boolean;
}

/**
 * Whether the item still claims attention.
 *
 * Note there is no branch on shape, on recurrence mode, or on whether the plan
 * repeats. The three behaviours described in the blueprint fall out of the same
 * expression, because what differs between them is not the rule but the facts:
 *
 * - **Action / project** — no recurrence, so no later occurrence can ever
 *   arrive. Carries until an outcome or a reschedule. Unbounded.
 * - **Habit / routine counting from a fixed start** — a later occurrence exists
 *   and is already calculated, so it arrives and replaces the carry-over.
 *   Bounded by the next occurrence.
 * - **Habit / routine counting from completion** — the next occurrence does not
 *   exist until this one is completed, so `laterOccurrenceArrived` is false by
 *   nature and the carry-over is unbounded.
 *
 * That last case is the consistency check that shows the rule is not ad hoc.
 * A bounded carry-over there would be incoherent: the item would disappear from
 * view and never return, because its next occurrence depends on a completion
 * there would no longer be anywhere to record. And it is the mode of the real
 * cases — shaving, cutting nails, taking the bins out — not an edge case.
 */
export function claimsAttention(item: ActionItem, facts: AttentionFacts): boolean {
  if (item.status !== 'todo') return false;
  if (!facts.overdue) return false;
  return !facts.laterOccurrenceArrived;
}

/**
 * Whether an item has been resolved, by any of the routes that resolve it.
 *
 * Both outcomes count. The difference between them is what they say, not
 * whether they settle the matter.
 */
export function isResolved(item: Pick<ActionItem, 'status'>): boolean {
  return item.status !== 'todo';
}
