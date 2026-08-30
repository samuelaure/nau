/**
 * The intention to review a note, and the rule that turns many of them into
 * one aggregate item on the agenda.
 *
 * Per `tmp/references-blueprint.md` §2.3: a note is "archived" simply by
 * having no `ReviewIntent`, and "active" by having one. Neither state is a
 * stored field on the note — it is derived from whether an intent exists,
 * same discipline Actions already applies to its own derived `Shape`
 * (`@nau/actions`' `shapeOf`). Organization (`Collection`, tags — see
 * `organization.ts`) is transversal to this: neither knows `ReviewIntent`
 * exists.
 */

/**
 * A note's plan to be revisited. Not a boolean and not a date stored on the
 * note — a reference to the real Actions item that carries the plan
 * (punctual or recurring) and its own completion history, per the reasoning
 * in `note.ts`'s capability doc: References never duplicates a schedule it
 * does not own.
 */
export interface ReviewIntent {
  readonly noteId: string;
  /** The Actions item that owns the plan and the completion state. */
  readonly actionItemId: string;
  /**
   * false (default): this review only counts toward `hasPendingReviews` — no
   * item of its own next to the user's actions and habits.
   *
   * true: this specific review gets its own item in Actions, visible next to
   * the user's other actions and habits, and stops counting toward
   * `hasPendingReviews` — it no longer needs the aggregate because it is
   * already visible on its own. Still appears in the "references to review"
   * list inside the References view (filtered by "active with an occurrence
   * in the period", not by elevation) — confirmed explicitly during design,
   * 2026-08-30.
   */
  readonly elevated: boolean;
}

/**
 * Whether the aggregate "Review references" item should be alive right now.
 *
 * References does not compute overdue-ness itself — that is Actions/Time's
 * question about the plan behind `actionItemId`. This function only combines
 * the answer with the elevation rule: an elevated intent is excluded,
 * because it already has its own visible item and would otherwise double the
 * signal.
 */
export function hasPendingReviews(
  intents: readonly ReviewIntent[],
  isOverdue: (actionItemId: string) => boolean,
): boolean {
  return intents.filter((i) => !i.elevated).some((i) => isOverdue(i.actionItemId));
}

/**
 * The two independent ways "Review references" can be marked done, both
 * confirmed during design (2026-08-30) and both real at once:
 *
 *   - it auto-completes once no non-elevated intent is overdue any more
 *     (the tray-emptying pattern GTD already uses for its own "process tray
 *     X" habit) — Actions/Time decide this, References only supplies the
 *     rule above that they evaluate against.
 *   - it can also be completed explicitly even while some remain overdue,
 *     to record a faithful history of a partial review session. Completing
 *     it this way must never mark the outstanding notes as reviewed — only
 *     the aggregate's own completion is written, never a note's.
 *
 * This is an invariant the caller (the Actions relation, when it implements
 * the aggregate's completion) must uphold — marking the aggregate done is
 * not the same act as marking a note reviewed, and the two must never be
 * conflated into one write. Nothing to enforce here in code; `core/` has no
 * persistence to guard.
 */
