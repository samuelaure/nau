import type { Period, ResolveContext } from '../../core/contract';
import type {
  JournalComposition,
  SourceDensity,
  SourcePlan,
} from '../../core/journal-relation';
import { GREGORIAN_SYSTEM_ID } from '../../systems/gregorian';

/**
 * How the Gregorian calendar composes a Journal synthesis.
 *
 * Kept apart from `systems/gregorian/` on purpose, and the dependency runs one
 * way: this file imports the system, the system knows nothing of this file.
 * Deleting Journal from the platform would mean deleting this folder and
 * touching nothing in `systems/`.
 *
 * The separation matters because `(Time·Gregorian)·Journal` is one relation
 * among several. `(Time·Gregorian)·Actions` is a different one and shares no
 * logic with it — Actions has no notion of composing a period from smaller
 * periods. Folding both into the system would put two unrelated concerns in one
 * file and make each harder to change without disturbing the other.
 *
 * This replaces `SUMMARY_SOURCE`, the fixed table that mapped `monthly → daily,
 * trimester → weekly, yearly → monthly`. That table only worked because it
 * assumed Gregorian; a naŭ of nine days or a lunation has no month-and-quarter
 * hierarchy to copy. Here the hierarchy is Gregorian's own statement about
 * itself, and every other system makes its own.
 */

/**
 * Which scale's syntheses feed each larger one.
 *
 * Samuel's rule, and each row is a deliberate choice rather than a pattern:
 *
 *   day      ← entries
 *   week     ← entries          (not daily syntheses: a week reads the days
 *                                themselves, keeping it close to what was lived)
 *   month    ← daily syntheses
 *   quarter  ← weekly syntheses
 *   year     ← monthly syntheses
 *
 * Note the quarter: a week can straddle a quarter boundary — the week of 29
 * June to 5 July belongs to both Q2 and Q3 — so reading weeks into a quarter
 * pulls in a few days from either side. That is accepted deliberately; months
 * would nest exactly but weeks are what Samuel wants a quarter to be made of.
 * Recorded here so the next reader knows it is a decision, not an oversight.
 */
const COMPOSES_FROM: Readonly<Record<string, string | null>> = {
  day: null,
  week: null,
  month: 'day',
  quarter: 'week',
  year: 'month',
};

/** The scale a period of this scale is composed from, if any. */
export function composesFrom(scale: string): string | null {
  return COMPOSES_FROM[scale] ?? null;
}

/**
 * The size past which a synthesis request is worth noticing.
 *
 * Deliberately NOT a switch that changes which sources are read: the
 * composition rule above is fixed, and silently swapping sources would make one
 * month's synthesis mean something different from the next. This is a
 * measurement threshold — the scheduler logs when a request exceeds it, so the
 * real numbers accumulate before anyone decides what to do about them.
 *
 * A chosen number, in one place, revisable against what those logs show.
 */
export const DIRECT_READ_TOKEN_BUDGET = 40_000;

export const gregorianJournal: JournalComposition = {
  /**
   * Where this period's synthesis reads from.
   *
   * Exactly one plan, because what a period is made of is a property of the
   * calendar rather than of how much happened to be written that month. If the
   * sources it names do not exist yet, the answer is to generate them first —
   * see the scheduler — not to fall back to a different kind of source.
   */
  preferredSources(period: Period, _ctx: ResolveContext): readonly SourcePlan[] {
    const smaller = COMPOSES_FROM[period.ref.scale] ?? null;

    // A day and a week read the entries themselves. Everything larger reads the
    // syntheses of one particular scale below — one plan, not a choice, because
    // which sources a period is made of is a property of the calendar rather
    // than of how much happened to be written that month.
    if (!smaller) {
      return [{ kind: 'entries', fromScale: null, range: period.interval }];
    }

    return [{ kind: 'syntheses', fromScale: smaller, range: period.interval }];
  },

  /**
   * Whether this period is worth narrating at all.
   *
   * A period nobody recorded is not a period to narrate. Generating one anyway
   * is how summaries of empty months describing events that never happened got
   * written once before, and the cheapest place to stop that is before the
   * model is called.
   */
  shouldSynthesise(_period: Period, density: SourceDensity): boolean {
    return density.count > 0;
  },
};

/**
 * Whether a request is large enough to be worth flagging.
 *
 * Reports rather than decides. Nothing changes behaviour on the strength of
 * this — it exists so the volume of real requests becomes visible before any
 * limit is imposed on the strength of a guess.
 */
export function exceedsBudget(density: SourceDensity): boolean {
  return density.estimatedTokens > DIRECT_READ_TOKEN_BUDGET;
}

/** The system this composition belongs to. Used when registering relations. */
export const gregorianJournalSystemId = GREGORIAN_SYSTEM_ID;
