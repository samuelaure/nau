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
 * A month reads days rather than weeks because weeks straddle month boundaries
 * — a week ending on the 3rd belongs to two months, and reading it into either
 * would import days that are not in that month. Days nest exactly, so they do
 * not have that problem.
 *
 * A quarter reads months, and a year reads quarters: each step compresses by
 * roughly the same factor, which keeps any one synthesis from being asked to
 * read an unmanageable number of sources.
 */
const COMPOSES_FROM: Readonly<Record<string, string>> = {
  week: 'day',
  month: 'day',
  quarter: 'month',
  year: 'quarter',
};

/**
 * How much material is worth reading directly before compressing instead.
 *
 * A threshold on real content rather than on the nominal length of the period,
 * which is the point: a quiet month may hold fewer entries than a busy week,
 * and should be read straight from the entries rather than through a layer of
 * summaries that adds nothing. Duration is a poor proxy for density and using
 * it as one is what made the old fixed table wrong in both directions.
 *
 * A chosen number, revisable against real usage — and in one place, so revising
 * it is one decision rather than a hunt.
 */
export const DIRECT_READ_TOKEN_BUDGET = 40_000;

export const gregorianJournal: JournalComposition = {
  /**
   * Where this period's synthesis should read from, best option first.
   *
   * Two candidates are offered rather than one, because which is right depends
   * on what is actually there. The caller asks Journal how dense each is and
   * takes the first that fits its budget:
   *
   * 1. The raw entries — truthful and complete, but unbounded in size.
   * 2. The syntheses of the scale below — bounded, at the cost of one layer of
   *    compression.
   *
   * A day has only the first: there is no smaller Gregorian scale to compose
   * from, so its synthesis always reads entries.
   */
  preferredSources(period: Period, _ctx: ResolveContext): readonly SourcePlan[] {
    const entries: SourcePlan = {
      kind: 'entries',
      fromScale: null,
      range: period.interval,
    };

    const smaller = COMPOSES_FROM[period.ref.scale];
    if (!smaller) return [entries];

    return [
      entries,
      {
        kind: 'syntheses',
        // Always a scale of this same system. Composing across systems would be
        // one system interpreting another's divisions, which is the single
        // thing translation must never do.
        fromScale: smaller,
        range: period.interval,
      },
    ];
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
 * Whether a candidate set is small enough to read directly.
 *
 * Exposed so the caller can walk `preferredSources` and decide, rather than
 * having the rule buried where it cannot be tested or tuned.
 */
export function fitsDirectRead(density: SourceDensity): boolean {
  return density.estimatedTokens <= DIRECT_READ_TOKEN_BUDGET;
}

/** The system this composition belongs to. Used when registering relations. */
export const gregorianJournalSystemId = GREGORIAN_SYSTEM_ID;
