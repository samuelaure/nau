import { RRule, rrulestr } from 'rrule';
import { dayjs, safeZone } from '../common/time';

export interface Occurrence {
  /** The instant the rule predicts, and the key an exception is matched on. */
  at: Date;
  /** Where it actually happens. Differs from `at` only when it was moved. */
  effectiveAt: Date;
  moved: boolean;
  /**
   * True when this occurrence is a guess rather than a commitment.
   *
   * Only anchored schedules produce these. Their next-but-one occurrence cannot
   * be known until the next one is done, so anything beyond the first is shown
   * as an estimate and never as a plan.
   */
  projected: boolean;
}

export interface ScheduleLike {
  startDate: Date;
  endDate: Date | null;
  rrule: string | null;
  timezone: string | null;
  recurrenceMode?: 'FIXED' | 'AFTER_COMPLETION';
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
  /** Latest completion, for anchored schedules. Ignored by fixed ones. */
  lastCompletedAt?: Date | null,
): Occurrence[] {
  const skipped = new Set<number>();
  const movedTo = new Map<number, Date>();

  for (const ex of exceptions) {
    const key = ex.occurrenceAt.getTime();
    if (ex.kind === 'SKIPPED') skipped.add(key);
    else if (ex.movedTo) movedTo.set(key, ex.movedTo);
  }

  const decorate = (at: Date, projected: boolean): Occurrence => {
    const moved = movedTo.get(at.getTime());
    return { at, effectiveAt: moved ?? at, moved: Boolean(moved), projected };
  };

  // No rule: the schedule is a single span, and it either overlaps the window or
  // it does not. A range rather than a point, because an action deferred to
  // "this week" is due across the whole week.
  if (!schedule.rrule) {
    const start = schedule.startDate;
    const end = schedule.endDate ?? schedule.startDate;
    if (end < windowStart || start > windowEnd) return [];
    if (skipped.has(start.getTime())) return [];
    return [decorate(start, false)];
  }

  if (schedule.recurrenceMode === 'AFTER_COMPLETION') {
    return anchoredOccurrences(schedule, windowStart, windowEnd, lastCompletedAt, decorate, skipped);
  }

  const rule = parseRule(schedule.rrule, schedule.startDate);
  if (!rule) return [];

  const hardEnd = schedule.endDate && schedule.endDate < windowEnd ? schedule.endDate : windowEnd;

  return rule
    .between(windowStart, hardEnd, true)
    .filter((at) => !skipped.has(at.getTime()))
    .map((at) => decorate(at, false));
}

/**
 * Occurrences of a schedule that counts from its last completion.
 *
 * There is only ever one real occurrence: the one that is due now. Everything
 * after it depends on when this one is actually done, so it is returned marked
 * as projected — useful to fill a week view, never to be mistaken for a plan.
 *
 * The pending occurrence is returned even when it falls before the window. An
 * overdue shave does not stop being due because the day it was due has passed;
 * dropping it would hide exactly the thing the person needs to see.
 */
function anchoredOccurrences(
  schedule: ScheduleLike,
  windowStart: Date,
  windowEnd: Date,
  lastCompletedAt: Date | null | undefined,
  decorate: (at: Date, projected: boolean) => Occurrence,
  skipped: Set<number>,
): Occurrence[] {
  const anchor = lastCompletedAt ?? schedule.startDate;
  const rule = parseRule(schedule.rrule!, anchor);
  if (!rule) return [];

  if (schedule.endDate && anchor > schedule.endDate) return [];

  const pending = rule.after(anchor, false);
  if (!pending) return [];
  if (schedule.endDate && pending > schedule.endDate) return [];
  if (pending > windowEnd) return [];
  if (skipped.has(pending.getTime())) return [];

  const out: Occurrence[] = [decorate(pending, false)];

  // An overdue occurrence gets no projections. Every one of them would be
  // premised on a completion that has not happened, so they would be answering
  // "when is the next shave, assuming you shaved on the fourth of July" — which
  // is a question nobody asked. One honest row beats a filled-in week.
  if (pending < windowStart) return out;

  let cursor = pending;
  for (let i = 0; i < 64; i += 1) {
    const next = rule.after(cursor, false);
    if (!next || next > windowEnd) break;
    if (schedule.endDate && next > schedule.endDate) break;
    if (!skipped.has(next.getTime())) out.push(decorate(next, true));
    cursor = next;
  }

  return out;
}

/**
 * How long one turn of the rule lasts, in milliseconds.
 *
 * Measured from the rule rather than read off its options, so it holds for
 * anything expressible in RFC 5545 — including rules whose gap is uneven, where
 * this returns the first gap and is right about the one that matters.
 *
 * Used to say how late an anchored schedule is *relative to its own rhythm*: two
 * days late means something different for a daily habit than for a monthly one.
 */
export function intervalMsOf(schedule: ScheduleLike, anchor: Date): number | null {
  if (!schedule.rrule) return null;
  const rule = parseRule(schedule.rrule, anchor);
  if (!rule) return null;

  const first = rule.after(anchor, false);
  if (!first) return null;
  const second = rule.after(first, false);
  if (!second) return null;

  return second.getTime() - first.getTime();
}

/**
 * How far past due an anchored schedule is, as a multiple of its own interval.
 *
 * 0 means due now, 1 means one whole interval late. The interface maps this onto
 * colour; keeping the arithmetic here means the scale is one decision in one
 * place rather than a magic number in a stylesheet.
 */
export function overdueRatio(dueAt: Date, intervalMs: number | null, now: Date): number {
  if (!intervalMs || intervalMs <= 0) return 0;
  const late = now.getTime() - dueAt.getTime();
  return late <= 0 ? 0 : late / intervalMs;
}

function parseRule(rule: string, dtstart: Date): RRule | null {
  try {
    // A rule may arrive as a bare RRULE line or as a full RFC 5545 block.
    return rrulestr(
      rule.includes('DTSTART')
        ? rule
        : `DTSTART:${toICalUtc(dtstart)}\n${normaliseRule(rule)}`,
    ) as RRule;
  } catch {
    // A malformed rule yields nothing rather than taking down the whole agenda
    // for every other block on the day.
    return null;
  }
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
