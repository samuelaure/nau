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

/**
 * `(Actions)·(Time)` — DRAFT, not yet confirmed by `module:time`.
 *
 * Per the method in nau#119: this is the contract Actions needs from Time to
 * finish `relations/time/` (`tmp/actions-blueprint.md` §3.1) — written now,
 * marked as unconfirmed, rather than waiting for Time to build its own side
 * first. Everything below is grounded in `@nau/time`'s real `core/contract.ts`
 * (imported, not guessed), plus the one operation nau#104 already asked Time
 * for and left explicitly unresolved.
 *
 * What this relation is for, per the blueprint:
 *   - expanding planned items over a window, asking Time for occurrences;
 *   - resolving carry-over's *display*: the core (`core/attention.ts`)
 *     decides whether an item still claims attention; this relation decides
 *     which period to draw it under;
 *   - counting how many periods separate two instants, for carry-over's
 *     `carriedPeriods` count — today `agenda.service.ts` computes this by
 *     walking `gregorianPeriodAt` in a loop, importing Gregorian by name
 *     directly inside Actions' relation, which is the exact coupling nau#104
 *     asks Time to retire.
 *
 * What is NOT drafted here: `periodsBetween` itself. nau#104 already
 * specifies its shape precisely (`periodsBetween(system, scale, from, to,
 * ctx): number | null`) as an operation Time's own `core/` or systems
 * publish — this file only names where Actions calls it from, not its
 * signature, so as not to duplicate a contract Time is already deciding.
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
 */
export interface ResolvedOccurrence {
  readonly occurrence: Occurrence;
  readonly period: Period;
}

/**
 * The one operation nau#104 already specified and left for Time to publish.
 * Restated here, not redefined, so this relation's code has something
 * concrete to call against while nau#104 is still open — the moment Time
 * ships the real thing, this type alias is deleted and every caller points
 * at Time's own export instead.
 *
 * `null` for a system where the question has no answer (`someday`,
 * trigger-driven systems) — never a caller-side special case, per nau#104's
 * own framing of the failure `AGENDA_TYPES` already taught this platform.
 */
export type PeriodsBetween = (
  system: SystemId,
  scale: ScaleId,
  from: Instant,
  to: Instant,
  ctx: ResolveContext,
) => number | null;
