import type { Instant } from './contract';

/**
 * Which zone a moment is read in.
 *
 * Two kinds of time live in this system and they behave in opposite ways, which
 * is the root of nearly every timezone bug there is:
 *
 * - An *occurred instant* — "I wrote this at 14:32" — never moves. It happened
 *   when it happened, and it is stored absolutely plus the zone it was lived in
 *   so it can still be read back as the 14:32 the person experienced.
 * - A *clock intention* — "every day at 08:00" — does move. It is a statement
 *   about a wall clock, so it must stay 08:00 across a DST boundary and must
 *   not become 15:00 because the person flew to Mexico. That is what
 *   `RecurrenceRule.timezone` carries, following TZID from RFC 5545.
 *
 * Conflating the two is what produces summaries covering the wrong span and
 * habits that drift an hour twice a year.
 */

/**
 * A zone the platform can actually compute in.
 *
 * An unknown or malformed IANA name makes date libraries throw from deep inside
 * a period calculation, which in a per-workspace loop takes down the run for
 * every workspace after it. Falling back to UTC keeps one bad row from
 * stopping the batch — the behaviour the system had before zones existed.
 */
export function safeZone(tz: string | null | undefined): string {
  if (!tz) return 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Whether a string is a zone this runtime knows. */
export function isValidZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A zone, and the moment it came into force for a workspace. */
export interface ZoneChange {
  readonly timezone: string;
  readonly effectiveAt: Instant;
}

/**
 * Where a workspace has lived, in order.
 *
 * A single current zone is not enough. Someone spends a season in Madrid and
 * then moves to Mexico City; with one field, changing it silently reinterprets
 * every period they ever recorded, and "August 2026" starts resolving in Mexico
 * although it was lived in Spain.
 *
 * The alternative considered and rejected was an elastic day — letting the
 * first period after a move absorb the difference, covering 26 hours so no time
 * is left orphaned. That is a magic value: a day that lies about what it is,
 * and the lie spreads into every average, chart and period count downstream.
 *
 * The orphan it was meant to prevent does not exist. A day is not a bucket
 * dividing up the timeline; it is the question "which instants fall on the 28th,
 * read from here". Ask the 28th in Madrid and the 29th in Mexico and no instant
 * is lost — each falls where it belongs. The labels may overlap or skip by two
 * hours, and that is correct: it records that the person moved.
 */
export class ZoneHistory {
  private readonly changes: readonly ZoneChange[];

  /** `changes` need not be sorted; the constructor orders them. */
  constructor(changes: readonly ZoneChange[], private readonly fallback = 'UTC') {
    this.changes = [...changes].sort(
      (a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime(),
    );
  }

  /** A workspace that has never moved, or whose history is not yet recorded. */
  static fixed(timezone: string): ZoneHistory {
    return new ZoneHistory([], safeZone(timezone));
  }

  /**
   * The zone in force at a given moment.
   *
   * A period is resolved in the zone it was lived in, which is what lets the
   * stored identity `{system, scale, anchor}` keep meaning the same thing after
   * a move. Had the resolved interval been stored instead, every past period
   * would need migrating each time someone changed zone.
   */
  at(instant: Instant): string {
    let active = this.fallback;
    for (const change of this.changes) {
      if (change.effectiveAt.getTime() > instant.getTime()) break;
      active = change.timezone;
    }
    return safeZone(active);
  }

  /** The zone in force now. What most callers want. */
  current(now: Instant = new Date()): string {
    return this.at(now);
  }
}
