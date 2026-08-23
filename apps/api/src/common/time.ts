import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import 'dayjs/locale/es';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.locale('es');

export { dayjs };

/**
 * The names the Gregorian calendar gives to its own divisions.
 *
 * Deliberately not "the period types the system has". Gregorian is one calendar
 * among several — the naŭ calendar runs nine-day weeks and twenty-seven-day
 * months, astrological periods follow transits, personal epochs follow where
 * someone was living — and each will name its divisions differently.
 *
 * What every calendar shares is the shape of the answer, `PeriodBounds`: two
 * instants and a label. Adding one is a new bounds function and a `Calendar`
 * row, not a change to everything that consumes a period.
 */
export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'trimester' | 'yearly' | 'custom';

export interface PeriodBounds {
  /** Inclusive start, as an absolute instant. */
  start: Date;
  /** Inclusive end, as an absolute instant. */
  end: Date;
  /** How the period reads in the zone it belongs to, for prompts and titles. */
  label: string;
}

/**
 * A zone we can actually compute in.
 *
 * An unknown or malformed IANA name makes dayjs throw deep inside a period
 * calculation, which would take down a cron for every workspace after it. A
 * workspace with a bad zone falls back to UTC — the behaviour it had before
 * timezones existed — instead of stopping the run.
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

/** The local wall-clock reading of an instant, in the given zone. */
export function localNow(tz: string, at: Date = new Date()) {
  return dayjs(at).tz(safeZone(tz));
}

/**
 * Resolves a date string to the day it names, in the given zone.
 *
 * The two forms mean different things and must not be handled alike:
 *
 * - `"2026-07-01"` names a calendar day and no instant at all. Parsing it with
 *   plain dayjs anchors it to the *server's* midnight, so on a machine in Madrid
 *   asking for July in a UTC workspace yields 30 June — the exact class of bug
 *   this module exists to remove. It is read as wall-clock time in `tz`.
 * - An ISO string carrying an offset names an instant, which is unambiguous. It
 *   is converted, and the calendar day it lands on in `tz` is the answer.
 */
export function dayIn(value: string, tz: string) {
  const zone = safeZone(tz);
  const trimmed = value.trim();
  const isBareDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  return isBareDate ? dayjs.tz(trimmed, zone) : dayjs(trimmed).tz(zone);
}

/**
 * The absolute instants that bound a period, as that period is lived in `tz`.
 *
 * The distinction matters everywhere the journal touches time: "20 August" in
 * Madrid is 2026-08-19T22:00Z to 2026-08-20T21:59Z, not midnight to midnight
 * UTC. `ref` is any instant inside the period being asked about.
 */
export function periodBounds(period: PeriodType, tz: string, ref: Date): PeriodBounds {
  const zone = safeZone(tz);
  const local = dayjs(ref).tz(zone);

  const of = (start: dayjs.Dayjs, end: dayjs.Dayjs, label: string): PeriodBounds => ({
    start: start.toDate(),
    end: end.toDate(),
    label,
  });

  switch (period) {
    case 'daily':
      return of(local.startOf('day'), local.endOf('day'), local.format('D [de] MMMM [de] YYYY'));

    case 'weekly': {
      // ISO weeks: Monday to Sunday. dayjs' plain `week` starts on Sunday, which
      // is what produced a weekly window offset by a day.
      const start = local.startOf('isoWeek');
      const end = local.endOf('isoWeek');
      return of(start, end, `semana del ${start.format('D [de] MMMM')} al ${end.format('D [de] MMMM [de] YYYY')}`);
    }

    case 'monthly':
      return of(local.startOf('month'), local.endOf('month'), local.format('MMMM [de] YYYY'));

    case 'trimester': {
      const quarter = Math.floor(local.month() / 3);
      const start = local.month(quarter * 3).startOf('month');
      const end = start.add(2, 'month').endOf('month');
      return of(start, end, `${quarter + 1}º trimestre de ${start.format('YYYY')}`);
    }

    case 'yearly':
      return of(local.startOf('year'), local.endOf('year'), local.format('YYYY'));

    case 'custom':
    default:
      return of(local.startOf('day'), local.endOf('day'), local.format('D [de] MMMM [de] YYYY'));
  }
}

/**
 * Bounds for the period that has just finished, relative to `ref`.
 *
 * What a scheduled summary always wants: the cron fires at the end of a day and
 * summarises that day, or on the first of a month and summarises the month
 * before. Passing `now` to periodBounds would give the period currently in
 * progress for everything except the daily.
 */
export function closedPeriodBounds(period: PeriodType, tz: string, ref: Date): PeriodBounds {
  const zone = safeZone(tz);
  const local = dayjs(ref).tz(zone);

  switch (period) {
    // The daily runs late on the day it covers, so the period in progress is the
    // one to summarise.
    case 'daily':
      return periodBounds('daily', zone, ref);
    case 'weekly':
      return periodBounds('weekly', zone, ref);
    case 'monthly':
      return periodBounds('monthly', zone, local.subtract(1, 'month').toDate());
    case 'trimester':
      return periodBounds('trimester', zone, local.subtract(1, 'month').toDate());
    case 'yearly':
      return periodBounds('yearly', zone, local.subtract(1, 'day').toDate());
    default:
      return periodBounds(period, zone, ref);
  }
}
