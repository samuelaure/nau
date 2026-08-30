import type { Outcome } from '../../core/contract';

/**
 * `(Actions)·(References)` — DRAFT, not yet confirmed by `module:references`.
 *
 * Per the method in nau#119: References already published the real half of
 * this contract — `packages/references/src/core/review-intent.ts`'s
 * `ReviewIntent`/`hasPendingReviews` — and left
 * `packages/references/src/relations/actions/` as an empty placeholder
 * waiting for Actions' side. This is that side, written from what
 * `review-intent.ts` already specifies rather than guessed, so it converges
 * quickly the way `(GTD)·(Actions)` and `(GTD)·(Journal)` already did.
 *
 * What this relation is for, per `tmp/references-blueprint.md` §3.1:
 *   - owning the aggregate "Revisar referencias" item — an ordinary
 *     `actions.item` (a habit, recurring per whatever cadence References
 *     asks for), created and possessed by Actions, never a fifth shape
 *     alongside action/habit/project/routine;
 *   - owning each *elevated* review's own individual item, when a note's
 *     `ReviewIntent.elevated` is true — again an ordinary `actions.item`,
 *     nothing about elevation changes what kind of thing it is;
 *   - answering `isOverdue(actionItemId)`, the one question
 *     `hasPendingReviews` needs from this side and cannot compute itself —
 *     it is Time's question about the plan behind an item, mediated through
 *     `core/attention.ts`'s `claimsAttention`, which is exactly what that
 *     function already exists to answer, just not yet exposed past this
 *     package's own boundary.
 */

/**
 * What creating (or keeping alive) the aggregate item needs from References.
 *
 * `recurrence` is References' decision, not Actions': the blueprint is
 * explicit that References decides the aggregate should exist and at what
 * background cadence the overdue check re-evaluates (daily, per the
 * worked example) — the same split GTD's "process tray X" habit already
 * uses (`tmp/gtd-blueprint.md` §3.1), restated here rather than duplicated
 * with different words.
 */
export interface ReviewAggregateSpec {
  readonly text: string;
  /** RFC 5545 rule, or whatever dialect the underlying system speaks. */
  readonly recurrence: string;
}

/**
 * The two ways "Revisar referencias" can be marked done, both real at once
 * per `review-intent.ts`'s own docstring — restated here as the contract
 * this relation must honour, not redefined:
 *
 *   - `'auto'` — no non-elevated `ReviewIntent` is overdue any more. Fires
 *     from this relation evaluating `hasPendingReviews` against `isOverdue`,
 *     never from References writing to an Actions item directly.
 *   - `'explicit'` — the person completed it by hand while some remain
 *     overdue, recording a faithful partial session. Must never mark any
 *     note's own `ReviewIntent` as resolved — only the aggregate's own
 *     `CompletionRecord` is written. Enforced by this relation never taking
 *     a note id as input to its completion path, only the aggregate's own
 *     item id.
 */
export type ReviewAggregateCompletionCause = 'auto' | 'explicit';

/**
 * The outcome recorded when the aggregate resolves, and how it got there.
 * `outcome` is `core/contract.ts`'s own `Outcome` — an aggregate is an
 * ordinary item, so it resolves the same two ways any other one does.
 */
export interface ReviewAggregateCompletion {
  readonly outcome: Outcome;
  readonly cause: ReviewAggregateCompletionCause;
}
