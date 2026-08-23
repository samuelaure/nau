import { occurrencesIn, type ScheduleLike, type ExceptionLike } from './occurrences';

const iso = (d: Date) => d.toISOString();

const schedule = (over: Partial<ScheduleLike> = {}): ScheduleLike => ({
  startDate: new Date('2026-08-17T08:00:00.000Z'), // a Monday
  endDate: null,
  rrule: null,
  timezone: null,
  ...over,
});

const week = {
  start: new Date('2026-08-17T00:00:00.000Z'),
  end: new Date('2026-08-23T23:59:59.999Z'),
};

describe('occurrences — derived, never stored', () => {
  describe('without a rule', () => {
    it('returns the single span when it overlaps the window', () => {
      const out = occurrencesIn(schedule(), [], week.start, week.end);

      expect(out).toHaveLength(1);
      expect(iso(out[0]!.at)).toBe('2026-08-17T08:00:00.000Z');
    });

    it('returns nothing when the span falls outside the window', () => {
      const out = occurrencesIn(
        schedule({ startDate: new Date('2026-09-01T08:00:00.000Z') }),
        [],
        week.start,
        week.end,
      );

      expect(out).toHaveLength(0);
    });

    it('counts a span that merely overlaps the window', () => {
      // An action deferred to "this week" is due across the whole week, so a
      // range that starts before the window still belongs to it.
      const out = occurrencesIn(
        schedule({
          startDate: new Date('2026-08-10T08:00:00.000Z'),
          endDate: new Date('2026-08-19T08:00:00.000Z'),
        }),
        [],
        week.start,
        week.end,
      );

      expect(out).toHaveLength(1);
    });
  });

  describe('with a rule', () => {
    it('expands a daily rule across the window without storing anything', () => {
      const out = occurrencesIn(
        schedule({ rrule: 'FREQ=DAILY' }),
        [],
        week.start,
        week.end,
      );

      expect(out).toHaveLength(7);
      expect(iso(out[0]!.at)).toBe('2026-08-17T08:00:00.000Z');
      expect(iso(out[6]!.at)).toBe('2026-08-23T08:00:00.000Z');
    });

    it('accepts a rule written with or without the RRULE prefix', () => {
      const bare = occurrencesIn(schedule({ rrule: 'FREQ=DAILY' }), [], week.start, week.end);
      const prefixed = occurrencesIn(schedule({ rrule: 'RRULE:FREQ=DAILY' }), [], week.start, week.end);

      expect(prefixed.map((o) => iso(o.at))).toEqual(bare.map((o) => iso(o.at)));
    });

    it('honours a weekday-only rule', () => {
      const out = occurrencesIn(
        schedule({ rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' }),
        [],
        week.start,
        week.end,
      );

      expect(out).toHaveLength(3);
    });

    it('stops at the schedule end date', () => {
      const out = occurrencesIn(
        schedule({ rrule: 'FREQ=DAILY', endDate: new Date('2026-08-19T23:59:59.000Z') }),
        [],
        week.start,
        week.end,
      );

      expect(out).toHaveLength(3);
    });

    it('yields nothing rather than throwing on a malformed rule', () => {
      // One bad rule must not take down the agenda for every other block on the
      // day.
      expect(() =>
        occurrencesIn(schedule({ rrule: 'FREQ=NONSENSE;;;' }), [], week.start, week.end),
      ).not.toThrow();
    });
  });

  describe('exceptions', () => {
    const daily = schedule({ rrule: 'FREQ=DAILY' });

    it('drops a skipped occurrence', () => {
      const exceptions: ExceptionLike[] = [
        { occurrenceAt: new Date('2026-08-19T08:00:00.000Z'), kind: 'SKIPPED', movedTo: null },
      ];

      const out = occurrencesIn(daily, exceptions, week.start, week.end);

      expect(out).toHaveLength(6);
      expect(out.map((o) => iso(o.at))).not.toContain('2026-08-19T08:00:00.000Z');
    });

    it('keeps a moved occurrence but reports where it went', () => {
      const exceptions: ExceptionLike[] = [
        {
          occurrenceAt: new Date('2026-08-19T08:00:00.000Z'),
          kind: 'MOVED',
          movedTo: new Date('2026-08-19T18:30:00.000Z'),
        },
      ];

      const out = occurrencesIn(daily, exceptions, week.start, week.end);
      const moved = out.find((o) => iso(o.at) === '2026-08-19T08:00:00.000Z')!;

      expect(out).toHaveLength(7);
      expect(moved.moved).toBe(true);
      expect(iso(moved.effectiveAt)).toBe('2026-08-19T18:30:00.000Z');
    });

    it('matches an exception on the instant the rule predicted', () => {
      // The predicted instant is the key. Matching on the moved time instead
      // would leave the original occurrence in place and add a second one.
      const exceptions: ExceptionLike[] = [
        {
          occurrenceAt: new Date('2026-08-19T18:30:00.000Z'),
          kind: 'SKIPPED',
          movedTo: null,
        },
      ];

      const out = occurrencesIn(daily, exceptions, week.start, week.end);

      expect(out).toHaveLength(7);
    });
  });
});
