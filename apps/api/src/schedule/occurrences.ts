import { RRule, rrulestr } from 'rrule';
import { dayjs, safeZone } from '../common/time';

export interface Occurrence {
  /** The instant the rule predicts, and the key an exception is matched on. */
  at: Date;
  /** Where it actually happens. Differs from `at` only when it was moved. */
  effectiveAt: Date;
  moved: boolean;
}

export interface ScheduleLike {
  startDate: Date;
  endDate: Date | null;
  rrule: string | null;
  timezone: string | null;
}

export interface ExceptionLike {
  occurrenceAt: Date;
  kind: 'SKIPPED' | 'MOVED';
  movedTo: Date | null;
}

/**
 * The occurrences of a schedule inside a window.
 *
 * Computed, never read from storage. A daily habit is one row and a rule; asking
 * what it means this week is arithmetic, and materialising 365 rows a year to
 * avoid that arithmetic buys nothing and costs a table that can drift from the
 * rule that generated it.
 *
 * Recurrence follows RFC 5545, via `rrule` — the same standard every calendar
 * speaks, which is also what makes an export or an import possible later.
 *
 * On the choice of library, checked 2026-08-22 rather than assumed: `rrule` has
 * not been published since November 2023, against `rrule-temporal` which was
 * published twelve days ago and adds RFC 7529 for non-Gregorian calendars. It is
 * still the right pick here. RFC 5545 was frozen in 2009, so a stale
 * spec-implementer is a far smaller risk than a stale framework; `rrule` carries
 * ten times the downloads; and `rrule-temporal` needs a Temporal polyfill, since
 * Node 22 does not ship it.
 *
 * RFC 7529 would not have bought the naŭ calendar either way — RSCALE names
 * calendars from CLDR, and an invented one is not in it. That needs its own
 * bounds function regardless of the library.
 *
 * The whole computation is contained in this file, so replacing it later is one
 * module rather than a migration.
 */
export function occurrencesIn(
  schedule: ScheduleLike,
  exceptions: ExceptionLike[],
  windowStart: Date,
  windowEnd: Date,
): Occurrence[] {
  const skipped = new Set<number>();
  const movedTo = new Map<number, Date>();

  for (const ex of exceptions) {
    const key = ex.occurrenceAt.getTime();
    if (ex.kind === 'SKIPPED') skipped.add(key);
    else if (ex.movedTo) movedTo.set(key, ex.movedTo);
  }

  // No rule: the schedule is a single span, and it either overlaps the window or
  // it does not. A range rather than a point, because an action deferred to
  // "this week" is due across the whole week.
  if (!schedule.rrule) {
    const start = schedule.startDate;
    const end = schedule.endDate ?? schedule.startDate;
    if (end < windowStart || start > windowEnd) return [];
    const moved = movedTo.get(start.getTime());
    if (skipped.has(start.getTime())) return [];
    return [{ at: start, effectiveAt: moved ?? start, moved: Boolean(moved) }];
  }

  let rule: RRule;
  try {
    // A rule may arrive as a bare RRULE line or as a full RFC 5545 block.
    rule = rrulestr(
      schedule.rrule.includes('DTSTART')
        ? schedule.rrule
        : `DTSTART:${toICalUtc(schedule.startDate)}\n${normaliseRule(schedule.rrule)}`,
    ) as RRule;
  } catch {
    // A malformed rule yields nothing rather than taking down the whole agenda
    // for every other block on the day.
    return [];
  }

  const hardEnd = schedule.endDate && schedule.endDate < windowEnd ? schedule.endDate : windowEnd;

  return rule
    .between(windowStart, hardEnd, true)
    .filter((at) => !skipped.has(at.getTime()))
    .map((at) => {
      const moved = movedTo.get(at.getTime());
      return { at, effectiveAt: moved ?? at, moved: Boolean(moved) };
    });
}

/**
 * The local wall-clock time a schedule lands on, in the zone the rule is read in.
 *
 * "Every weekday at 08:00" is a statement about a wall clock, not about an
 * absolute instant, and the two diverge by an hour twice a year.
 */
export function localTimeOf(schedule: ScheduleLike, at: Date, fallbackZone: string): string {
  return dayjs(at).tz(safeZone(schedule.timezone ?? fallbackZone)).format('HH:mm');
}

function normaliseRule(rule: string): string {
  const trimmed = rule.trim();
  return trimmed.toUpperCase().startsWith('RRULE:') ? trimmed : `RRULE:${trimmed}`;
}

function toICalUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
