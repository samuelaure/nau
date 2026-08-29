import type { ResolveContext } from '../../core/contract';
import { closedPeriodAt, dayIn, periodAt, periodsIn } from './periods';
import { contains } from '../../core/interval';

const at = (iso: string) => new Date(iso);
const iso = (d: Date | null) => (d === null ? null : d.toISOString());

const inZone = (timezone: string, firstDayOfWeek?: 0 | 1): ResolveContext => ({
  timezone,
  config: firstDayOfWeek === undefined ? {} : { firstDayOfWeek },
});

describe('periodAt — day', () => {
  // The distinction the whole module turns on: a day is lived somewhere, so its
  // boundaries are the local midnights, not UTC's.
  it('bounds a Madrid day at local midnight, not UTC midnight', () => {
    const period = periodAt('day', at('2026-08-20T12:00:00Z'), inZone('Europe/Madrid'));
    expect(iso(period!.interval.start)).toBe('2026-08-19T22:00:00.000Z');
    expect(iso(period!.interval.end)).toBe('2026-08-20T22:00:00.000Z');
  });

  it('bounds a UTC day at UTC midnight', () => {
    const period = periodAt('day', at('2026-08-20T12:00:00Z'), inZone('UTC'));
    expect(iso(period!.interval.start)).toBe('2026-08-20T00:00:00.000Z');
    expect(iso(period!.interval.end)).toBe('2026-08-21T00:00:00.000Z');
  });

  // 22:30 UTC on the 19th is already the 20th in Madrid. Reading it in UTC would
  // file two hours of every day under the day before.
  it('assigns a late-evening UTC instant to the next Madrid day', () => {
    const period = periodAt('day', at('2026-08-19T22:30:00Z'), inZone('Europe/Madrid'));
    expect(period!.name).toBe('20 de agosto de 2026');
  });

  it('is half-open: the end instant belongs to the next day', () => {
    const period = periodAt('day', at('2026-08-20T12:00:00Z'), inZone('UTC'))!;
    expect(contains(period.interval, period.interval.start)).toBe(true);
    expect(contains(period.interval, period.interval.end!)).toBe(false);
  });

  // Spain moves its clocks on 25 October 2026, making that day 25 hours long.
  it('covers a 25-hour day across the autumn DST change', () => {
    const period = periodAt('day', at('2026-10-25T12:00:00Z'), inZone('Europe/Madrid'))!;
    const hours = (period.interval.end!.getTime() - period.interval.start.getTime()) / 3_600_000;
    expect(hours).toBe(25);
  });

  it('covers a 23-hour day across the spring DST change', () => {
    const period = periodAt('day', at('2026-03-29T12:00:00Z'), inZone('Europe/Madrid'))!;
    const hours = (period.interval.end!.getTime() - period.interval.start.getTime()) / 3_600_000;
    expect(hours).toBe(23);
  });

  it('falls back to UTC for a malformed zone instead of throwing', () => {
    const period = periodAt('day', at('2026-08-20T12:00:00Z'), inZone('Not/AZone'));
    expect(iso(period!.interval.start)).toBe('2026-08-20T00:00:00.000Z');
  });
});

describe('periodAt — week', () => {
  // 2026-08-20 is a Thursday.
  const thursday = at('2026-08-20T12:00:00Z');

  it('defaults to a week starting on Sunday', () => {
    const period = periodAt('week', thursday, inZone('UTC'))!;
    expect(iso(period.interval.start)).toBe('2026-08-16T00:00:00.000Z');
    expect(iso(period.interval.end)).toBe('2026-08-23T00:00:00.000Z');
  });

  it('honours an explicit Monday start', () => {
    const period = periodAt('week', thursday, inZone('UTC', 1))!;
    expect(iso(period.interval.start)).toBe('2026-08-17T00:00:00.000Z');
    expect(iso(period.interval.end)).toBe('2026-08-24T00:00:00.000Z');
  });

  // The boundary case that gets a week wrong by one: with a Monday start,
  // Sunday closes the week that is ending rather than opening the next.
  it('puts Sunday at the end of a Monday-start week', () => {
    const sunday = at('2026-08-23T12:00:00Z');
    const period = periodAt('week', sunday, inZone('UTC', 1))!;
    expect(iso(period.interval.start)).toBe('2026-08-17T00:00:00.000Z');
  });

  it('puts Sunday at the start of a Sunday-start week', () => {
    const sunday = at('2026-08-23T12:00:00Z');
    const period = periodAt('week', sunday, inZone('UTC', 0))!;
    expect(iso(period.interval.start)).toBe('2026-08-23T00:00:00.000Z');
  });

  it('always spans seven days', () => {
    for (const firstDay of [0, 1] as const) {
      const period = periodAt('week', thursday, inZone('UTC', firstDay))!;
      const days = (period.interval.end!.getTime() - period.interval.start.getTime()) / 86_400_000;
      expect(days).toBe(7);
    }
  });

  it('ignores a malformed firstDayOfWeek rather than failing', () => {
    const period = periodAt('week', thursday, { timezone: 'UTC', config: { firstDayOfWeek: 9 } })!;
    expect(iso(period.interval.start)).toBe('2026-08-16T00:00:00.000Z');
  });
});

describe('periodAt — month, quarter, year', () => {
  it('bounds a month in the workspace zone', () => {
    const period = periodAt('month', at('2026-08-20T12:00:00Z'), inZone('Europe/Madrid'))!;
    expect(iso(period.interval.start)).toBe('2026-07-31T22:00:00.000Z');
    expect(iso(period.interval.end)).toBe('2026-08-31T22:00:00.000Z');
    expect(period.name).toBe('agosto de 2026');
  });

  it('bounds a quarter as three whole months', () => {
    const period = periodAt('quarter', at('2026-08-20T12:00:00Z'), inZone('UTC'))!;
    expect(iso(period.interval.start)).toBe('2026-07-01T00:00:00.000Z');
    expect(iso(period.interval.end)).toBe('2026-10-01T00:00:00.000Z');
    expect(period.name).toBe('3º trimestre de 2026');
  });

  it('bounds a year', () => {
    const period = periodAt('year', at('2026-08-20T12:00:00Z'), inZone('UTC'))!;
    expect(iso(period.interval.start)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(period.interval.end)).toBe('2027-01-01T00:00:00.000Z');
  });

  it('handles February in a leap year', () => {
    const period = periodAt('month', at('2028-02-15T12:00:00Z'), inZone('UTC'))!;
    const days = (period.interval.end!.getTime() - period.interval.start.getTime()) / 86_400_000;
    expect(days).toBe(29);
  });
});

describe('periodAt — unknown scales', () => {
  it('returns null for a scale this system does not own', () => {
    expect(periodAt('lunation', at('2026-08-20T12:00:00Z'), inZone('UTC'))).toBeNull();
  });
});

describe('periodsIn', () => {
  it('enumerates the days of a range without gaps or overlaps', () => {
    const days = periodsIn(
      'day',
      { start: at('2026-08-01T00:00:00Z'), end: at('2026-08-08T00:00:00Z') },
      inZone('UTC'),
    );
    expect(days).toHaveLength(7);
    for (let i = 1; i < days.length; i += 1) {
      // Half-open adjacency: each period's end is exactly the next one's start.
      expect(iso(days[i - 1]!.interval.end)).toBe(iso(days[i]!.interval.start));
    }
  });

  // Stepping by a fixed 24 hours would drift here; taking each day's own end as
  // the next one's start cannot.
  it('stays aligned across a DST transition', () => {
    const days = periodsIn(
      'day',
      { start: at('2026-10-24T00:00:00Z'), end: at('2026-10-28T00:00:00Z') },
      inZone('Europe/Madrid'),
    );
    for (let i = 1; i < days.length; i += 1) {
      expect(iso(days[i - 1]!.interval.end)).toBe(iso(days[i]!.interval.start));
    }
    expect(days.every((d) => d.interval.start.getTime() % 3_600_000 === 0)).toBe(true);
  });

  it('enumerates months of differing lengths correctly', () => {
    const months = periodsIn(
      'month',
      { start: at('2026-01-15T00:00:00Z'), end: at('2026-04-15T00:00:00Z') },
      inZone('UTC'),
    );
    expect(months.map((m) => m.name)).toEqual([
      'enero de 2026',
      'febrero de 2026',
      'marzo de 2026',
      'abril de 2026',
    ]);
  });

  it('includes a period that merely overlaps the start of the range', () => {
    const months = periodsIn(
      'month',
      { start: at('2026-08-20T00:00:00Z'), end: at('2026-09-05T00:00:00Z') },
      inZone('UTC'),
    );
    expect(months.map((m) => m.name)).toEqual(['agosto de 2026', 'septiembre de 2026']);
  });

  it('returns nothing for an unbounded range rather than looping forever', () => {
    expect(periodsIn('day', { start: at('2026-08-01T00:00:00Z'), end: null }, inZone('UTC')))
      .toHaveLength(0);
  });

  it('returns nothing for an unknown scale', () => {
    expect(
      periodsIn(
        'lunation',
        { start: at('2026-08-01T00:00:00Z'), end: at('2026-08-08T00:00:00Z') },
        inZone('UTC'),
      ),
    ).toHaveLength(0);
  });
});

describe('closedPeriodAt', () => {
  // What a scheduled synthesis wants: the period that just ended, never the one
  // in progress. Summarising a month on its first day would describe nothing.
  it('returns the previous month when asked on the first of a month', () => {
    const period = closedPeriodAt('month', at('2026-09-01T01:00:00Z'), inZone('UTC'))!;
    expect(period.name).toBe('agosto de 2026');
  });

  it('returns the previous day just after local midnight', () => {
    const period = closedPeriodAt('day', at('2026-08-20T22:30:00Z'), inZone('Europe/Madrid'))!;
    expect(period.name).toBe('20 de agosto de 2026');
  });

  it('returns the previous week when asked at the start of a week', () => {
    // Sunday 23 August opens a Sunday-start week; the closed one began the 16th.
    const period = closedPeriodAt('week', at('2026-08-23T00:30:00Z'), inZone('UTC', 0))!;
    expect(iso(period.interval.start)).toBe('2026-08-16T00:00:00.000Z');
  });

  it('returns the previous year on 1 January', () => {
    const period = closedPeriodAt('year', at('2027-01-01T02:00:00Z'), inZone('UTC'))!;
    expect(period.name).toBe('2026');
  });

  // Stepping back one nominal month from 31 March would land on 3 March in some
  // implementations. Stepping back from the period's own start cannot.
  it('is exact stepping back from a long month into a short one', () => {
    const period = closedPeriodAt('month', at('2026-03-31T12:00:00Z'), inZone('UTC'))!;
    expect(period.name).toBe('febrero de 2026');
  });
});

describe('dayIn', () => {
  // A bare date names a calendar day and no instant. Parsed plainly it anchors
  // to the server's midnight, so a machine in Madrid asking about a UTC
  // workspace answers the day before.
  it('reads a bare date as wall-clock time in the given zone', () => {
    expect(dayIn('2026-07-01', 'Europe/Madrid').toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(dayIn('2026-07-01', 'UTC').toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('reads a full ISO instant as the instant it names', () => {
    expect(dayIn('2026-07-01T10:00:00Z', 'Europe/Madrid').toISOString()).toBe(
      '2026-07-01T10:00:00.000Z',
    );
  });
});
