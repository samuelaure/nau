import type { Interval, Period, ResolveContext, ScaleId } from './contract';

/**
 * The Time↔Journal relation, and only that relation.
 *
 * Deciding which entries or which lower-grain syntheses compose a period's
 * synthesis is not a core concern and not a general one. It belongs to each
 * time system, because each composes differently: Gregorian reads days into a
 * month and weeks into a quarter; naŭ would use its own scales; ephemeris may
 * have no comparable hierarchy and simply not compose at all.
 *
 * This is what retires `SUMMARY_SOURCE`, the fixed table that mapped
 * `monthly → daily, trimester → weekly`. It was a Gregorian table wearing the
 * costume of a general one, and under a multi-system model there is no single
 * hierarchy for it to describe.
 *
 * Time↔Journal and Time↔Actions are separate relations that share no logic.
 * Actions has no notion of composing sources, so this interface stays apart
 * rather than being folded into a general contract both would half-implement.
 *
 * A system implements this only if it composes syntheses. Not implementing it
 * is a valid answer, and the core does not miss it.
 */

/** What Journal reads to build a synthesis: raw entries, or smaller syntheses. */
export type SourceKind = 'entries' | 'syntheses';

/**
 * Where a period's synthesis should read from.
 *
 * A plan, not the content. The system says which scale to draw on; resolving
 * that into concrete ids is the application's job, since only it can see the
 * database.
 */
export interface SourcePlan {
  readonly kind: SourceKind;
  /**
   * The scale whose syntheses feed this one. Null when reading raw entries.
   *
   * Always a scale of the same system — a Gregorian month reads Gregorian days.
   * Composing across systems would mean one system interpreting another's
   * divisions, which is the one thing translation must never do.
   */
  readonly fromScale: ScaleId | null;
  /** The stretch the sources must fall within. */
  readonly range: Interval;
}

/**
 * How much material a candidate set holds, for choosing between plans.
 *
 * Journal answers this cheaply — a count or a token estimate, without loading
 * the text — so a system can decide by real density rather than by the nominal
 * length of the period. A quiet month may go straight to entries; a dense week
 * may not.
 */
export interface SourceDensity {
  readonly count: number;
  readonly estimatedTokens: number;
}

/**
 * Implemented by systems that know how to compose a synthesis for a period.
 *
 * `preferredSources` returns candidate plans in order of preference. The
 * application walks them, asks Journal how dense each is, and takes the first
 * that fits its budget — so the choice between "read the days" and "read the
 * entries" is made against what is actually there, not against the calendar.
 */
export interface JournalComposition {
  preferredSources(period: Period, ctx: ResolveContext): readonly SourcePlan[];

  /**
   * Whether this period is worth synthesising at all, given what it holds.
   *
   * Lets a system decline an empty stretch before an LLM call is made. A period
   * nobody recorded is not a period to narrate — generating one anyway is how
   * summaries of empty months describing events that never happened got written
   * once before.
   */
  shouldSynthesise?(period: Period, density: SourceDensity): boolean;
}
