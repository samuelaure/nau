/**
 * What every time system must be able to say about itself.
 *
 * A time system *is* a set of scales. The different ways of dividing time are
 * the different scales — they are not shared between systems. `{gregorian,
 * month}` and `{nau, monato}` are distinct scales that happen to have similar
 * names, and nothing in this file lets one be mistaken for the other.
 *
 * The core knows four systems will implement this, and is built so that none of
 * them is the special case:
 *
 * - Gregorian — scales that nest, RFC 5545 recurrence, cheap arithmetic.
 * - naŭ — scales that do NOT tile: days 1-9, 10-18, 19-27, and the remainder is
 *   "fin de mes", a division of another nature.
 * - Ephemeris — irregular duration, boundaries at arbitrary instants, and
 *   projection that is exact but expensive and non-arithmetic.
 * - Triggers — cannot project at all; periods are open-ended, concurrent, and
 *   declared from outside rather than computed.
 *
 * If a signature here only makes sense for Gregorian, the core has stopped
 * being agnostic and the signature is wrong.
 */

/** An absolute point on the timeline. The only thing all systems share. */
export type Instant = Date;

/** Identifies a time system. Systems register themselves under these. */
export type SystemId = string;

/**
 * Identifies a scale *within* a system. Never meaningful on its own — always
 * carried alongside the system it belongs to. See `ScaleRef`.
 */
export type ScaleId = string;

/**
 * A stretch of the timeline, half-open: `[start, end)`.
 *
 * Half-open on purpose. With inclusive ends, two adjacent periods both contain
 * the boundary instant, so an item at midnight lands in two days at once and
 * every consumer has to break the tie the same way or the counts disagree.
 * Half-open makes adjacency exact: one period's end IS the next one's start,
 * and every instant belongs to exactly one of them.
 */
export interface Interval {
  start: Instant;
  /** Exclusive. An open-ended period (see `Capabilities.openEnded`) has none. */
  end: Instant | null;
}

/**
 * One division a system makes of the timeline.
 *
 * Scales are declared by the system that owns them. There is deliberately no
 * global enum of scales: that would put five systems' vocabularies into one
 * list and force every consumer to know which values are legal where.
 */
export interface Scale {
  readonly id: ScaleId;
  /** How the system names this scale, for interfaces. */
  readonly name: string;
  /**
   * Roughly how long one period of this scale lasts, in milliseconds.
   *
   * Typical, never exact — a month is 28-31 days, a lunation 29.27-29.83. It
   * exists for exactly one purpose: comparing scales across systems, so a naŭ
   * (9 days) can be recognised as comparable to a week (7 days). It must never
   * be used to compute a boundary; that is what `periodAt` is for.
   */
  readonly typicalMs: number;
  /**
   * The scale that contains this one, if the system declares one.
   *
   * Optional by design, and the first system to prove why is Gregorian itself:
   * a week crosses month boundaries, so it has no parent. A naŭ fits inside
   * nothing, and a lunation less. A core that assumed a clean hierarchy would
   * break on the second system it met.
   */
  readonly parent?: ScaleId;
}

/** A scale, qualified by the system that owns it. The minimum referenceable unit. */
export interface ScaleRef {
  readonly system: SystemId;
  readonly scale: ScaleId;
}

/**
 * The identity of one concrete period. This is what gets stored.
 *
 * `anchor` names the period without measuring it: any instant inside it will
 * do, and the system resolves it back to the same period every time. That is
 * what makes the identity survive a timezone change — "August 2026" resolves
 * with whichever zone was in force in August 2026, and nothing has to be
 * migrated when the workspace moves.
 */
export interface PeriodRef extends ScaleRef {
  readonly anchor: Instant;
}

/**
 * A period, resolved.
 *
 * `interval` is DERIVED, always. Storing it as the truth is what would leave
 * every past period pointing at a shifted span the moment a workspace changes
 * zone — and every Journal synthesis hanging off an "August" that is no longer
 * August.
 */
export interface Period {
  readonly ref: PeriodRef;
  readonly interval: Interval;
  /** The system's own name for it: "agosto de 2026". Not a user's title. */
  readonly name: string;
}

/**
 * A recurrence rule, as the system that owns it understands it.
 *
 * Deliberately not an RRULE string. RFC 5545 describes Gregorian arithmetic and
 * cannot express "every full moon" or an externally triggered event — those are
 * ephemeris positions and manual triggers, not calendar maths. RSCALE from RFC
 * 7529 does not help either: it names CLDR calendars, and neither naŭ nor lunar
 * are in it.
 *
 * So the rule is an opaque string plus the system that can read it. Gregorian
 * stores an RRULE in `expression` as its own private business; nothing outside
 * `systems/gregorian` may parse it.
 */
export interface RecurrenceRule {
  readonly system: SystemId;
  readonly expression: string;
  /**
   * The IANA zone the rule is read in. Null means the workspace's own zone.
   *
   * A rule is an intention about a wall clock, not about an instant: "every day
   * at 08:00" must stay 08:00 across a DST boundary, and must not become 15:00
   * because the person flew to Mexico. This is TZID from RFC 5545, and it is
   * why recurrence carries its own zone separately from the instants it
   * produces.
   */
  readonly timezone: string | null;
}

/**
 * One instant a recurrence rule lands on.
 *
 * `at` is what the rule predicted, and the key everything else is recorded
 * against — completion included, so catching up on yesterday's habit is
 * recorded against yesterday rather than against the moment of ticking.
 */
export interface Occurrence {
  readonly at: Instant;
  /** Where it actually falls. Differs from `at` only when it was moved. */
  readonly effectiveAt: Instant;
  readonly moved: boolean;
  /**
   * True when this is a guess rather than a commitment.
   *
   * A system that counts from the last completion cannot know its next-but-one
   * occurrence until this one is done, so everything past the first is an
   * estimate. Marking it is what stops an interface from drawing a conjecture
   * as a plan — the alternative is inventing a date and presenting it as fact.
   */
  readonly projected: boolean;
}

/**
 * A deliberate change to one occurrence of a rule.
 *
 * Not an error, which is why it is not called an exception: skipping Tuesday's
 * run or moving Friday's meeting is a decision, and it is matched back to the
 * occurrence it replaces by the instant the rule originally predicted.
 */
export interface OccurrenceOverride {
  readonly occurrenceAt: Instant;
  readonly kind: 'SKIPPED' | 'MOVED';
  /** Where it moved to. Null when skipped. */
  readonly movedTo: Instant | null;
}

/** Per-system settings. Each system declares its own shape and validates it. */
export type SystemConfig = Readonly<Record<string, unknown>>;

/**
 * What a system needs in order to resolve anything.
 *
 * Timezone is REQUIRED, not optional, and that is a decision with a scar behind
 * it: the previous design made the calendar config an optional parameter, and
 * Journal simply never passed it — so a workspace whose week started on Sunday
 * got Sunday weeks in its agenda and Monday weeks in its summaries, silently,
 * for as long as nobody compared the two. Required means the compiler finds the
 * next such omission instead of a user finding it.
 */
export interface ResolveContext {
  /** IANA zone the periods are lived in. */
  readonly timezone: string;
  /** Settings belonging to the system itself. Gregorian: firstDayOfWeek. */
  readonly config: SystemConfig;
}

export interface OccurrenceContext extends ResolveContext {
  /** Deliberate changes to individual occurrences. */
  readonly overrides: readonly OccurrenceOverride[];
  /** Where the rule starts counting when there is no completion yet. */
  readonly startAt: Instant;
  /**
   * Latest completion, for rules that count from it rather than from a fixed
   * start. Systems whose rules are pure functions of their start ignore it.
   */
  readonly lastCompletedAt?: Instant | null;
  /** When the rule stops applying, if it does. */
  readonly endAt?: Instant | null;
}

/**
 * What a system can and cannot do.
 *
 * This is what makes the core agnostic rather than Gregorian-with-extras. Each
 * flag exists because at least one real system answers it differently, and
 * without them that system would have to lie.
 */
export interface Capabilities {
  /**
   * Whether the system can enumerate periods that have not happened yet.
   *
   * False for trigger-driven systems, and not for want of data: a period that
   * begins when a person says so depends on that person saying so. Such a
   * system knows what is running now and what ran before, and nothing about
   * September. Without this flag it would have to invent an estimated date,
   * which an interface would then draw as a plan.
   */
  readonly projects: boolean;
  /**
   * What resolving a period costs.
   *
   * `arithmetic` is Gregorian and naŭ: pure calculation, free to call in a
   * loop. `computed` is ephemeris: exact and projectable, but astronomical
   * computation a caller should batch and cache. A core that assumed everything
   * is cheap would fire those calculations once per row on screen.
   */
  readonly cost: 'arithmetic' | 'computed';
  /** Whether several periods of the same scale can run at once. */
  readonly concurrent: boolean;
  /** Whether periods can have no known end until something closes them. */
  readonly openEnded: boolean;
}

/**
 * The contract every time system implements.
 *
 * Three questions, and no more: which period contains this instant, which
 * periods fall in this stretch, and when does this rule land. Everything a
 * consumer needs is expressible in those terms, and nothing here presumes a
 * particular calendar.
 */
export interface TimeSystem {
  readonly id: SystemId;
  readonly name: string;
  readonly scales: readonly Scale[];
  readonly capabilities: Capabilities;

  /**
   * The period of this scale containing the instant, or null if there is none.
   *
   * Null is a real answer, not a failure. In the naŭ calendar the 28th of a
   * 31-day month belongs to no naŭ at all — it falls in "fin de mes", which is
   * a different scale. Modelling that as a short naŭ would be a sentinel: a
   * thing pretending to be another because the model cannot say "this is
   * different".
   */
  periodAt(scale: ScaleId, at: Instant, ctx: ResolveContext): Period | null;

  /**
   * Every period of this scale overlapping the range, in chronological order.
   *
   * A system that cannot project (see `Capabilities.projects`) returns only
   * what it already knows — typically what has been declared up to now — rather
   * than inventing entries to fill the range.
   */
  periodsIn(scale: ScaleId, range: Interval, ctx: ResolveContext): readonly Period[];

  /** The instants a rule lands on inside the range. */
  occurrences(
    rule: RecurrenceRule,
    range: Interval,
    ctx: OccurrenceContext,
  ): readonly Occurrence[];

  /** Rejects a config this system cannot honour. Returns the reasons, if any. */
  validateConfig?(config: SystemConfig): readonly string[];
}
