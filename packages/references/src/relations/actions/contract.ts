/**
 * `(References)·(Actions)` — confirms `packages/actions/src/relations/references/contract.ts`
 * (nau#120), written directly against `../../core/review-intent.ts`.
 *
 * Both sides of `ReviewAggregateSpec`/`ReviewAggregateCompletion` are exactly
 * right as drafted — no corrections, unlike `(GTD)·(Actions)` (nau#114,
 * `blockId` naming) or `(GTD)·(Journal)` (nau#115, a scope error). This file
 * exists to answer the three open questions the draft correctly declined to
 * decide unilaterally, and to publish References' own half so
 * `packages/actions` can converge the way `(GTD)·(References)` (nau#117)
 * already did on this side's contract.
 *
 * ## Open question 1 — who creates the aggregate, and when
 *
 * **Lazily, on the first non-elevated `ReviewIntent` that needs it — never
 * an explicit workspace setup step.** Same pattern GTD's own "process tray
 * X" habit already uses (`tmp/gtd-blueprint.md` §3.1): the aggregate is
 * created (or kept alive) exactly when something pending needs it to exist,
 * not provisioned ahead of use. Concretely: whenever
 * `hasPendingReviews`(`../../core/review-intent.ts`) would need to answer
 * for a workspace and no aggregate item exists there yet, the persistence
 * layer (`apps/api`'s relation, on behalf of either side) creates one via
 * `ReviewAggregateSpec`. There is no "References confirms setup" step
 * because there is nothing to confirm — the spec is fully determined
 * (`text`, `recurrence`) with no per-workspace choice References defers to
 * a person.
 *
 * ## Open question 2 — the creation contract itself
 *
 * `ReviewAggregateSpec` (already published by Actions) is already sufficient
 * on its own — it needs no counterpart type from this side. References does
 * not construct an `actions.item`'s full properties (that is Actions'
 * shape, same as `orderIntoActions` never being References' to write); it
 * only supplies the two fields the blueprint already said are References'
 * decision. Nothing to add here.
 *
 * ## Open question 3 — where `isOverdue` lives
 *
 * Partially resolved, and worth stating precisely rather than papering over
 * the gap. `core/attention.ts`'s `claimsAttention` is already exported from
 * `@nau/actions`' root (`export * from './core/attention'`) — nothing to
 * expose, it is public today. But `claimsAttention` needs `AttentionFacts`
 * (`overdue`, `laterOccurrenceArrived`), and *resolving* those from a real
 * plan and occurrence is not done through it in production yet — confirmed
 * by reading `apps/api/src/relations/api-actions/agenda.service.ts`
 * (2026-08-30), which computes its own overdue signal directly against
 * `AGENDA_TYPES` and raw occurrence data, bypassing `core/attention.ts`
 * entirely. That file is the pre-rebuild agenda `(Time)·(Actions)` is meant
 * to replace (nau#64), not yet done.
 *
 * So `AggregateIsOverdue` below is the shape this relation needs —
 * `(actionItemId: string) => boolean` — but *implementing* it correctly
 * means resolving through whatever the finished `(Time)·(Actions)` relation
 * exposes, not reimplementing agenda's overdue logic a second time inside
 * References. Until that relation exists, `apps/api`'s
 * `ReferencesService.hasPendingReviewAggregate` (added alongside this
 * contract) is deliberately left unimplemented — a stub raising rather than
 * guessing at a second overdue algorithm — with this comment as the pointer
 * to what unblocks it.
 */

/**
 * The question `hasPendingReviews` (`../../core/review-intent.ts`) needs
 * answered and cannot answer itself — whether the Actions item behind a
 * `ReviewIntent.actionItemId` still claims attention. Backed by
 * `@nau/actions`' `core/attention.ts`'s `claimsAttention`, mediated through
 * whatever plan/occurrence data the persistence layer resolves; this
 * package never reasons about Time directly.
 */
export type AggregateIsOverdue = (actionItemId: string) => boolean;
