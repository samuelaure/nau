import type { Instant, Interval, RecurrenceRule } from '../../core/contract';
import { occurrences, overdueRatio, type GregorianOccurrenceContext } from './recurrence';

const at = (iso: string) => new Date(iso);
const iso = (d: Instant) => d.toISOString();

const rule = (expression: string): RecurrenceRule => ({
  system: 'gregorian',
  expression,
  timezone: null,
});

// 17 August 2026 is a Monday.
const MONDAY = at('2026-08-17T08:00:00Z');

const week: Interval = { start: at('2026-08-17T00:00:00Z'), end: at('2026-08-24T00:00:00Z') };

const ctx = (over: Partial<GregorianOccurrenceContext> = {}): GregorianOccurrenceContext => ({
  timezone: 'UTC',
  config: {},
  overrides: [],
  startAt: MONDAY,
  ...over,
});

describe('occurrences — fixed rules', () => {
  it('expands a daily rule across the window', () => {
    const out = occurrences(rule('FREQ=DAILY'), week, ctx());
    expect(out).toHaveLength(7);
    expect(iso(out[0]!.at)).toBe('2026-08-17T08:00:00.000Z');
  });

  it('accepts a rule with or without the RRULE prefix', () => {
    const bare = occurrences(rule('FREQ=DAILY'), week, ctx());
    const prefixed = occurrences(rule('RRULE:FREQ=DAILY'), week, ctx());
    expect(prefixed.map((o) => iso(o.at))).toEqual(bare.map((o) => iso(o.at)));
  });

  it('expands a weekdays-only rule', () => {
    const out = occurrences(rule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'), week, ctx());
    expect(out).toHaveLength(5);
  });

  it('respects an end date', () => {
    const out = occurrences(
      rule('FREQ=DAILY'),
      week,
      ctx({ endAt: at('2026-08-19T23:59:59Z') }),
    );
    expect(out).toHaveLength(3);
  });

  // A malformed rule must not take down the agenda for every other item that
  // day, so it yields nothing rather than throwing.
  it('yields nothing for a malformed rule instead of throwing', () => {
    expect(occurrences(rule('NOT A RULE'), week, ctx())).toHaveLength(0);
  });

  it('returns nothing for an unbounded window', () => {
    expect(
      occurrences(rule('FREQ=DAILY'), { start: week.start, end: null }, ctx()),
    ).toHaveLength(0);
  });

  it('marks nothing as projected: a fixed rule is a commitment', () => {
    const out = occurrences(rule('FREQ=DAILY'), week, ctx());
    expect(out.every((o) => !o.projected)).toBe(true);
  });
});

describe('occurrences — overrides', () => {
  it('drops a skipped occurrence', () => {
    const out = occurrences(
      rule('FREQ=DAILY'),
      week,
      ctx({
        overrides: [
          { occurrenceAt: at('2026-08-19T08:00:00Z'), kind: 'SKIPPED', movedTo: null },
        ],
      }),
    );
    expect(out).toHaveLength(6);
    expect(out.map((o) => iso(o.at))).not.toContain('2026-08-19T08:00:00.000Z');
  });

  // The moved occurrence keeps the instant the rule predicted as its identity,
  // so completion recorded against it still matches after the move.
  it('moves an occurrence while keeping its original identity', () => {
    const out = occurrences(
      rule('FREQ=DAILY'),
      week,
      ctx({
        overrides: [
          {
            occurrenceAt: at('2026-08-19T08:00:00Z'),
            kind: 'MOVED',
            movedTo: at('2026-08-19T18:00:00Z'),
          },
        ],
      }),
    );
    const moved = out.find((o) => iso(o.at) === '2026-08-19T08:00:00.000Z')!;
    expect(moved.moved).toBe(true);
    expect(iso(moved.effectiveAt)).toBe('2026-08-19T18:00:00.000Z');
  });
});

describe('occurrences — anchored to completion', () => {
  const anchored = (over: Partial<GregorianOccurrenceContext> = {}) =>
    ctx({ mode: 'AFTER_COMPLETION', ...over });

  it('counts from the last completion, not from the start', () => {
    const out = occurrences(
      rule('FREQ=DAILY;INTERVAL=3'),
      week,
      anchored({ lastCompletedAt: at('2026-08-18T08:00:00Z') }),
    );
    expect(iso(out[0]!.at)).toBe('2026-08-21T08:00:00.000Z');
  });

  it('treats the first occurrence as a commitment and the rest as guesses', () => {
    const out = occurrences(
      rule('FREQ=DAILY;INTERVAL=2'),
      week,
      anchored({ lastCompletedAt: at('2026-08-17T08:00:00Z') }),
    );
    expect(out[0]!.projected).toBe(false);
    expect(out.slice(1).every((o) => o.projected)).toBe(true);
  });

  // An overdue item does not stop being due because its day has passed.
  // Dropping it would hide exactly what the person needs to see.
  it('still returns an overdue occurrence that falls before the window', () => {
    const out = occurrences(
      rule('FREQ=DAILY;INTERVAL=3'),
      week,
      anchored({ lastCompletedAt: at('2026-08-01T08:00:00Z') }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.at.getTime()).toBeLessThan(week.start.getTime());
  });

  // Every projection past an overdue item would assume a completion that never
  // happened — answering a question nobody asked.
  it('offers no projections past an overdue occurrence', () => {
    const out = occurrences(
      rule('FREQ=DAILY'),
      week,
      anchored({ lastCompletedAt: at('2026-08-01T08:00:00Z') }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.projected).toBe(false);
  });

  it('falls back to the start when nothing has been completed', () => {
    const out = occurrences(rule('FREQ=DAILY;INTERVAL=3'), week, anchored());
    expect(iso(out[0]!.at)).toBe('2026-08-20T08:00:00.000Z');
  });

  it('stops once the rule has ended', () => {
    const out = occurrences(
      rule('FREQ=DAILY'),
      week,
      anchored({
        lastCompletedAt: at('2026-08-17T08:00:00Z'),
        endAt: at('2026-08-17T09:00:00Z'),
      }),
    );
    expect(out).toHaveLength(0);
  });
});

describe('overdueRatio', () => {
  it('is zero before the due instant', () => {
    const ratio = overdueRatio(
      rule('FREQ=DAILY'),
      at('2026-08-20T08:00:00Z'),
      at('2026-08-19T08:00:00Z'),
      MONDAY,
    );
    expect(ratio).toBe(0);
  });

  it('is one when a whole turn has passed', () => {
    const ratio = overdueRatio(
      rule('FREQ=DAILY'),
      at('2026-08-20T08:00:00Z'),
      at('2026-08-21T08:00:00Z'),
      MONDAY,
    );
    expect(ratio).toBeCloseTo(1, 5);
  });

  // The reason lateness is measured against the *next* occurrence rather than a
  // duration read once off the rule: FREQ=MONTHLY has no constant interval, so
  // a single number reused all year would be wrong for most of it.
  it('measures a monthly rule against its own varying turn', () => {
    const monthly = rule('FREQ=MONTHLY');
    const febStart = at('2026-02-01T08:00:00Z');

    const afterFeb = overdueRatio(monthly, febStart, at('2026-03-01T08:00:00Z'), febStart);
    expect(afterFeb).toBeCloseTo(1, 5);

    // March is three days longer than February; a fixed interval would report
    // more than a whole turn late here.
    const marStart = at('2026-03-01T08:00:00Z');
    const afterMar = overdueRatio(monthly, marStart, at('2026-04-01T08:00:00Z'), marStart);
    expect(afterMar).toBeCloseTo(1, 5);
  });

  it('is zero for a malformed rule rather than throwing', () => {
    expect(
      overdueRatio(rule('NOT A RULE'), at('2026-08-20T08:00:00Z'), at('2026-08-25T08:00:00Z'), MONDAY),
    ).toBe(0);
  });
});
