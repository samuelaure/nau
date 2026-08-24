import { periodBounds, closedPeriodBounds, dayIn, safeZone, localNow } from './time';

const MADRID = 'Europe/Madrid';
const NY = 'America/New_York';

describe('time — a day belongs to a place', () => {
  describe('safeZone', () => {
    it('falls back to UTC rather than throwing on an unusable zone', () => {
      // A bad zone deep inside a period calculation would take down the cron for
      // every workspace queued behind it.
      expect(safeZone('Mars/Olympus')).toBe('UTC');
      expect(safeZone('')).toBe('UTC');
      expect(safeZone(null)).toBe('UTC');
      expect(safeZone(MADRID)).toBe(MADRID);
    });
  });

  describe('dayIn', () => {
    it('reads a bare calendar date as wall-clock time in the target zone', () => {
      // The whole class of bug: "2026-07-01" parsed as an instant lands on the
      // server's midnight, which is a different day almost everywhere else.
      expect(dayIn('2026-07-01', 'UTC').startOf('day').toISOString()).toBe('2026-07-01T00:00:00.000Z');
      expect(dayIn('2026-07-01', MADRID).startOf('day').toISOString()).toBe('2026-06-30T22:00:00.000Z');
      expect(dayIn('2026-07-01', NY).startOf('day').toISOString()).toBe('2026-07-01T04:00:00.000Z');
    });

    it('reads an ISO instant as the day it lands on in the target zone', () => {
      // 00:30 UTC on the 21st is still the evening of the 20th in New York.
      expect(dayIn('2026-08-21T00:30:00.000Z', NY).format('YYYY-MM-DD')).toBe('2026-08-20');
      expect(dayIn('2026-08-21T00:30:00.000Z', MADRID).format('YYYY-MM-DD')).toBe('2026-08-21');
    });
  });

  describe('periodBounds', () => {
    const ref = new Date('2026-08-20T12:00:00.000Z');

    it('bounds a day by the local midnights around it', () => {
      const utc = periodBounds('daily', 'UTC', ref);
      expect(utc.start.toISOString()).toBe('2026-08-20T00:00:00.000Z');
      expect(utc.end.toISOString()).toBe('2026-08-20T23:59:59.999Z');

      // Madrid is UTC+2 in August, so its day runs two hours earlier in absolute
      // terms. Anything captured between 22:00 and midnight UTC is already
      // tomorrow there — which is the misfiling this replaces.
      const madrid = periodBounds('daily', MADRID, ref);
      expect(madrid.start.toISOString()).toBe('2026-08-19T22:00:00.000Z');
      expect(madrid.end.toISOString()).toBe('2026-08-20T21:59:59.999Z');
    });

    it('runs the week Monday to Sunday', () => {
      // 20 August 2026 is a Thursday.
      const w = periodBounds('weekly', 'UTC', ref);
      expect(w.start.toISOString()).toBe('2026-08-17T00:00:00.000Z');
      expect(w.end.toISOString()).toBe('2026-08-23T23:59:59.999Z');
    });

    it('starts the week where the calendar says, not where ISO does', () => {
      // 20 August 2026 is a Thursday. A week only exists inside Gregorian, so
      // which day opens it is a property of that calendar and not of the person
      // reading it.
      const monday = periodBounds('weekly', 'UTC', ref, { firstDayOfWeek: 1 });
      expect(monday.start.toISOString()).toBe('2026-08-17T00:00:00.000Z');
      expect(monday.end.toISOString()).toBe('2026-08-23T23:59:59.999Z');

      const sunday = periodBounds('weekly', 'UTC', ref, { firstDayOfWeek: 0 });
      expect(sunday.start.toISOString()).toBe('2026-08-16T00:00:00.000Z');
      expect(sunday.end.toISOString()).toBe('2026-08-22T23:59:59.999Z');
    });

    it('defaults to Monday, which is what every existing calculation assumed', () => {
      const withoutConfig = periodBounds('weekly', 'UTC', ref);
      const explicitMonday = periodBounds('weekly', 'UTC', ref, { firstDayOfWeek: 1 });

      expect(withoutConfig.start.toISOString()).toBe(explicitMonday.start.toISOString());
    });

    it('handles the Sunday edge, where ISO and a Sunday week disagree most', () => {
      // On a Sunday, ISO says the week is ending; a Sunday-first week says it is
      // beginning. Getting this backwards is what made every weekly summary
      // cover an empty future week for months.
      const onSunday = new Date('2026-08-23T12:00:00.000Z');

      expect(periodBounds('weekly', 'UTC', onSunday, { firstDayOfWeek: 1 }).start.toISOString())
        .toBe('2026-08-17T00:00:00.000Z');
      expect(periodBounds('weekly', 'UTC', onSunday, { firstDayOfWeek: 0 }).start.toISOString())
        .toBe('2026-08-23T00:00:00.000Z');
    });

    it('bounds the month and the quarter the day falls in', () => {
      const m = periodBounds('monthly', 'UTC', ref);
      expect(m.start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
      expect(m.end.toISOString()).toBe('2026-08-31T23:59:59.999Z');

      // August is in Q3: July through September.
      const q = periodBounds('trimester', 'UTC', ref);
      expect(q.start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
      expect(q.end.toISOString()).toBe('2026-09-30T23:59:59.999Z');
      expect(q.label).toContain('3º trimestre');
    });

    it('names the period in Spanish, for the prompts that quote it', () => {
      expect(periodBounds('daily', 'UTC', ref).label).toBe('20 de agosto de 2026');
      expect(periodBounds('monthly', 'UTC', ref).label).toBe('agosto de 2026');
      expect(periodBounds('yearly', 'UTC', ref).label).toBe('2026');
    });
  });

  describe('closedPeriodBounds', () => {
    it('gives the day in progress, which is the one the 23:00 run closes', () => {
      const b = closedPeriodBounds('daily', 'UTC', new Date('2026-08-20T23:00:00.000Z'));
      expect(b.label).toBe('20 de agosto de 2026');
    });

    it('gives the previous month when it runs on the first', () => {
      const b = closedPeriodBounds('monthly', 'UTC', new Date('2026-09-01T01:00:00.000Z'));
      expect(b.start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
      expect(b.end.toISOString()).toBe('2026-08-31T23:59:59.999Z');
    });

    it('gives the previous quarter when it runs on the first of a new one', () => {
      const b = closedPeriodBounds('trimester', 'UTC', new Date('2026-10-01T02:00:00.000Z'));
      expect(b.start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
      expect(b.end.toISOString()).toBe('2026-09-30T23:59:59.999Z');
    });

    it('gives the previous year when it runs on the first of January', () => {
      const b = closedPeriodBounds('yearly', 'UTC', new Date('2027-01-01T03:00:00.000Z'));
      expect(b.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(b.end.toISOString()).toBe('2026-12-31T23:59:59.999Z');
    });

    it('gives the week that just ended when it runs late on Sunday', () => {
      // 23 August 2026 is a Sunday.
      const b = closedPeriodBounds('weekly', 'UTC', new Date('2026-08-23T23:00:00.000Z'));
      expect(b.start.toISOString()).toBe('2026-08-17T00:00:00.000Z');
      expect(b.end.toISOString()).toBe('2026-08-23T23:59:59.999Z');
    });
  });

  describe('localNow', () => {
    it('reads the wall clock where the workspace is, which is what the cron asks', () => {
      // 21:00 UTC is 23:00 in Madrid: the hour the day closes there, and an
      // ordinary afternoon in New York.
      const at = new Date('2026-08-20T21:00:00.000Z');
      expect(localNow(MADRID, at).hour()).toBe(23);
      expect(localNow('UTC', at).hour()).toBe(21);
      expect(localNow(NY, at).hour()).toBe(17);
    });
  });
});
