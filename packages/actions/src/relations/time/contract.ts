import type {
  Instant,
  Occurrence,
  OccurrenceContext,
  Period,
  RecurrenceRule,
  ResolveContext,
  ScaleId,
  SystemId,
} from '@nau/time';
import { periodsBetween } from '@nau/time';

/**
 * `(Actions)·(Time)` — confirmed by `module:time` on nau#121 (2026-08-30).
 *
 * Written per the method in nau#119: this is the contract Actions needs from
 * Time to finish `relations/time/` (`tmp/actions-blueprint.md` §3.1),
 * written before Time's side existed, grounded in `@nau/time`'s real
 * `core/contract.ts` rather than guessed. Confirmation found two things
 * worth keeping visible rather than silently folding in:
 *
 *   - `periodsBetween` shipped for real (`@nau/time`'s own export, nau#104)
 *     with one more parameter (`registry`) than this file's draft alias
 *     assumed, because it walks the real registered system rather than
 *     assuming one. Imported directly below; the draft alias is gone.
 *   - Building it surfaced a bug in Time's own first implementation, not in
 *     anything drafted here: testing `periodAt(...) === null` at the start
 *     instant as "this system can't answer" is wrong — naŭ returns `null`
 *     for "fin de mes" and still projects fine. The right test is
 *     `capabilities.projects`. Left here as a note because it is exactly
 *     the distinction this file already got right elsewhere (`someday` as
 *     `null` via a capability, never a caller-side special case) — worth
 *     remembering it can still slip in by a different door.
 *
 * What this relation is for, per the blueprint:
 *   - expanding planned items over a window, asking Time for occurrences;
 *   - resolving carry-over's *display*: the core (`core/attention.ts`)
 *     decides whether an item still claims attention; this relation decides
 *     which period to draw it under;
 *   - counting how many periods separate two instants, for carry-over's
 *     `carriedPeriods` count, via `periodsBetween` below.
 */

/**
 * A block's placement in time, as Actions reads it — not `@nau/time`'s
 * internal `Planning` row, which carries persistence fields (`blockId`,
 * `id`, timestamps) this relation has no business seeing.
 */
export interface ItemPlan {
  readonly system: SystemId;
  readonly scale: ScaleId;
  readonly anchor: Instant;
  readonly recurrence: RecurrenceRule | null;
  /** Where the rule counts from, when it recurs. Ignored otherwise. */
  readonly countsFromCompletion: boolean;
}

/**
 * Occurrences of one planned item, inside a window.
 *
 * A thin restatement of `TimeSystem.occurrences` (`@nau/time`'s own method)
 * at the granularity a relation actually calls it: one plan, one range, the
 * context Time needs to resolve it. Kept as its own interface rather than
 * inlining `TimeSystem` itself, so this relation's boundary test can verify
 * it never imports a concrete system (`gregorian`, `someday`) by name — only
 * the neutral vocabulary `@nau/time`'s core already exports.
 */
export interface OccurrencesInWindow {
  readonly plan: ItemPlan;
  readonly window: { readonly from: Instant; readonly to: Instant };
  readonly ctx: OccurrenceContext;
}

/**
 * What resolving occurrences returns: the occurrences themselves, plus the
 * period each one falls under — what `relations/time/` needs to decide
 * *which period to draw a row under*, per the blueprint's own description of
 * what this relation does with carry-over.
 *
 * **Not delivered together by `TimeSystem.occurrences`** — confirmed against
 * `contract.ts:282-286`, which returns only `Occurrence[]`. Composing this
 * shape costs one extra `periodAt(scale, occurrence.effectiveAt, ctx)` call
 * per occurrence, paid by whoever implements this relation for real. Free
 * with Gregorian (`cost: 'arithmetic'`); worth batching or caching for a
 * `cost: 'computed'` system (ephemeris) resolving a window with many
 * occurrences — nothing to optimise yet with only Gregorian registered.
 */
export interface ResolvedOccurrence {
  readonly occurrence: Occurrence;
  readonly period: Period;
}

export { periodsBetween };
