import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { periodAt } from './periods';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Parity with the implementation this replaces.
 *
 * `apps/api/src/common/time.ts` bounded periods with an INCLUSIVE end
 * (`endOf('day')`, i.e. 23:59:59.999). This module uses a half-open interval,
 * so the same period now ends at the following midnight.
 *
 * The two describe the same stretch of time and differ by exactly one
 * millisecond at the boundary. Pinning that here makes the change explicit
 * rather than something a reader has to infer during the migration.
 */
describe('parity with the previous inclusive-end bounds', () => {
  const ctx = { timezone: 'Europe/Madrid', config: { firstDayOfWeek: 1 } };
  const at = new Date('2026-08-20T12:00:00Z');

  it('starts a day exactly where the old implementation did', () => {
    const oldStart = dayjs(at).tz('Europe/Madrid').startOf('day').toDate();
    expect(periodAt('day', at, ctx)!.interval.start.toISOString()).toBe(oldStart.toISOString());
  });

  it('ends a day one millisecond after the old inclusive end', () => {
    const oldEnd = dayjs(at).tz('Europe/Madrid').endOf('day').toDate();
    const newEnd = periodAt('day', at, ctx)!.interval.end!;
    expect(newEnd.getTime() - oldEnd.getTime()).toBe(1);
  });

  it('starts a Monday-based week exactly where the old implementation did', () => {
    const local = dayjs(at).tz('Europe/Madrid');
    const offset = (local.day() - 1 + 7) % 7;
    const oldStart = local.subtract(offset, 'day').startOf('day').toDate();
    expect(periodAt('week', at, ctx)!.interval.start.toISOString()).toBe(oldStart.toISOString());
  });

  it('starts a month exactly where the old implementation did', () => {
    const oldStart = dayjs(at).tz('Europe/Madrid').startOf('month').toDate();
    expect(periodAt('month', at, ctx)!.interval.start.toISOString()).toBe(oldStart.toISOString());
  });

  it('produces the same period names as the old implementation', () => {
    expect(periodAt('day', at, ctx)!.name).toBe('20 de agosto de 2026');
    expect(periodAt('month', at, ctx)!.name).toBe('agosto de 2026');
    expect(periodAt('year', at, ctx)!.name).toBe('2026');
  });
});
