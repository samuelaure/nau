import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import 'dayjs/locale/es';

import type { Instant, Interval, Period, ResolveContext, ScaleId } from '../../core/contract';
import { safeZone } from '../../core/zone';
import { readConfig } from './config';
import { findScale } from './scales';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);
dayjs.locale('es');

export { dayjs };

/**
 * Where the Gregorian calendar puts its boundaries.
 *
 * Everything here turns on one distinction: a period is lived in a place, so
 * "20 August" in Madrid is 2026-08-19T22:00Z to 2026-08-20T22:00Z, not midnight
 * to midnight UTC. Reading it in the server's zone files two hours of every day
 * under the day before — the class of bug this module exists to remove.
 *
 * Intervals are half-open, `[start, end)`. One period's end is the next one's
 * start, exactly, so an instant at midnight belongs to one day rather than two.
 */

/**
 * The day a date string names, read in the given zone.
 *
 * The two forms mean different things and must not be treated alike:
 *
 * - `"2026-07-01"` names a calendar day and no instant at all. Parsed plainly
 *   it anchors to the *server's* midnight, so a machine in Madrid asking about
 *   July for a UTC workspace answers 30 June.
 * - An ISO string carrying an offset names an instant, which is unambiguous. It
 *   is converted, and the calendar day it lands on in `tz` is the answer.
 */
export function dayIn(value: string, tz: string): dayjs.Dayjs {
  const zone = safeZone(tz);
  const trimmed = value.trim();
  const isBareDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  return isBareDate ? dayjs.tz(trimmed, zone) : dayjs(trimmed).tz(zone);
}

/** The local wall-clock reading of an instant. */
export function localNow(tz: string, at: Instant = new Date()): dayjs.Dayjs {
  return dayjs(at).tz(safeZone(tz));
}

const interval = (start: dayjs.Dayjs, endExclusive: dayjs.Dayjs): Interval => ({
  start: start.toDate(),
  end: endExclusive.toDate(),
});

/**
 * The start of the period `count` units after this one, in local terms.
 *
 * `dayjs.add(1, 'day')` adds twenty-four hours, which is not the same thing as
 * advancing the calendar by a day. On the night Spain puts its clocks back, the
 * 25th of October is twenty-five hours long, and adding twenty-four lands at
 * 23:00 on the 25th rather than at midnight on the 26th — so the day would end
 * an hour early and that hour would belong to no day at all.
 *
 * Re-taking `startOf` after the addition snaps back to the real local boundary,
 * which is correct whether the day was 23, 24 or 25 hours long.
 */
const advance = (
  from: dayjs.Dayjs,
  count: number,
  unit: 'day' | 'month' | 'year',
): dayjs.Dayjs => from.add(count, unit).startOf(unit === 'day' ? 'day' : unit);

/**
 * The period of a scale that contains an instant.
 *
 * Never returns null: the Gregorian scales tile the timeline completely, so
 * every instant is in exactly one day, one week, one month, one quarter and one
 * year. That is a property of *this* calendar, not of the contract — the naŭ
 * system returns null for a day that falls in no naŭ, and the core allows it.
 */
export function periodAt(scale: ScaleId, at: Instant, ctx: ResolveContext): Period | null {
  if (!findScale(scale)) return null;

  const zone = safeZone(ctx.timezone);
  const local = dayjs(at).tz(zone);
  const ref = { system: 'gregorian', scale, anchor: at };

  switch (scale) {
    case 'day':
      return {
        ref,
        interval: interval(local.startOf('day'), advance(local.startOf('day'), 1, 'day')),
        name: local.format('D [de] MMMM [de] YYYY'),
      };

    case 'week': {
      // Which day opens a week belongs to the calendar, not to the timeline.
      // Both halves of the platform must agree on it or the list shows one week
      // while the summaries describe another, and nothing says so.
      const { firstDayOfWeek } = readConfig(ctx.config);
      const offset = (local.day() - firstDayOfWeek + 7) % 7;
      const start = local.subtract(offset, 'day').startOf('day');
      const end = advance(start, 7, 'day');
      return {
        ref,
        interval: interval(start, end),
        name: `semana del ${start.format('D [de] MMMM')} al ${end
          .subtract(1, 'day')
          .format('D [de] MMMM [de] YYYY')}`,
      };
    }

    case 'month':
      return {
        ref,
        interval: interval(local.startOf('month'), advance(local.startOf('month'), 1, 'month')),
        name: local.format('MMMM [de] YYYY'),
      };

    case 'quarter': {
      const index = Math.floor(local.month() / 3);
      const start = local.month(index * 3).startOf('month');
      return {
        ref,
        interval: interval(start, advance(start, 3, 'month')),
        name: `${index + 1}º trimestre de ${start.format('YYYY')}`,
      };
    }

    case 'year':
      return {
        ref,
        interval: interval(local.startOf('year'), advance(local.startOf('year'), 1, 'year')),
        name: local.format('YYYY'),
      };

    default:
      return null;
  }
}

/**
 * Every period of a scale overlapping a range, in order.
 *
 * Walks by resolving the period at the range's start and stepping to its end,
 * rather than adding a fixed duration: months are 28 to 31 days and a DST
 * transition makes a day 23 or 25 hours long, so stepping by a constant drifts.
 * Taking each period's own end as the next one's start cannot.
 */
export function periodsIn(
  scale: ScaleId,
  range: Interval,
  ctx: ResolveContext,
): readonly Period[] {
  if (!findScale(scale)) return [];
  // An unbounded range would enumerate forever. Gregorian projects infinitely,
  // so the caller has to say where to stop.
  if (range.end === null) return [];

  const out: Period[] = [];
  let cursor = periodAt(scale, range.start, ctx);

  // Bounded so a malformed range or a zone bug cannot spin: a decade of days is
  // well inside this, and anything beyond it is a caller error worth failing on.
  for (let guard = 0; guard < 4096; guard += 1) {
    if (!cursor) break;
    if (cursor.interval.start.getTime() >= range.end.getTime()) break;

    out.push(cursor);

    const next = cursor.interval.end;
    if (next === null) break;
    cursor = periodAt(scale, next, ctx);
  }

  return out;
}

/**
 * The period of this scale that has just finished, relative to an instant.
 *
 * What a scheduled synthesis always wants: the run fires just after a period
 * closes and summarises the one that ended, never the one in progress. Asking
 * for the period containing `now` would summarise a month on its first day,
 * when nothing has happened in it yet.
 *
 * Implemented by stepping back from the start of the current period rather than
 * subtracting a nominal duration, so it is right across months of different
 * lengths and across a DST boundary.
 */
export function closedPeriodAt(
  scale: ScaleId,
  at: Instant,
  ctx: ResolveContext,
): Period | null {
  const current = periodAt(scale, at, ctx);
  if (!current) return null;

  // One millisecond before this period began is inside the previous one,
  // whatever its length.
  const justBefore = new Date(current.interval.start.getTime() - 1);
  return periodAt(scale, justBefore, ctx);
}
