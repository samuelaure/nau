import {
  SCALE_TOLERANCE,
  comparableToScale,
  contains,
  durationMs,
  overlaps,
  visibleIn,
} from './interval';
import type { Interval } from './contract';

const at = (iso: string) => new Date(iso);
const span = (from: string, to: string | null): Interval => ({
  start: at(from),
  end: to === null ? null : at(to),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const NAU_MS = 9 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

describe('durationMs', () => {
  it('measures a bounded stretch', () => {
    expect(durationMs(span('2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z'))).toBe(DAY_MS);
  });

  it('treats an open-ended stretch as infinite', () => {
    expect(durationMs(span('2026-08-01T00:00:00Z', null))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('overlaps', () => {
  const view = span('2026-08-10T00:00:00Z', '2026-08-17T00:00:00Z');

  it('finds a block starting inside the view', () => {
    expect(overlaps(span('2026-08-12T00:00:00Z', '2026-08-20T00:00:00Z'), view)).toBe(true);
  });

  it('finds a block ending inside the view', () => {
    expect(overlaps(span('2026-08-01T00:00:00Z', '2026-08-12T00:00:00Z'), view)).toBe(true);
  });

  it('finds a block wholly inside the view', () => {
    expect(overlaps(span('2026-08-11T00:00:00Z', '2026-08-12T00:00:00Z'), view)).toBe(true);
  });

  // The case the original rule missed: neither end falls inside, yet the block
  // is running throughout. Testing only the ends would drop it silently.
  it('finds a block that contains the whole view', () => {
    expect(overlaps(span('2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z'), view)).toBe(true);
  });

  it('rejects a block entirely before the view', () => {
    expect(overlaps(span('2026-08-01T00:00:00Z', '2026-08-05T00:00:00Z'), view)).toBe(false);
  });

  it('rejects a block entirely after the view', () => {
    expect(overlaps(span('2026-08-20T00:00:00Z', '2026-08-25T00:00:00Z'), view)).toBe(false);
  });

  // Half-open intervals: adjacency is exact, so a block ending exactly when the
  // view begins is not in it. Without this, an item at midnight lands in two
  // days at once.
  it('rejects a block ending exactly at the view start', () => {
    expect(overlaps(span('2026-08-01T00:00:00Z', '2026-08-10T00:00:00Z'), view)).toBe(false);
  });

  it('includes a block starting exactly at the view start', () => {
    expect(overlaps(span('2026-08-10T00:00:00Z', '2026-08-11T00:00:00Z'), view)).toBe(true);
  });

  it('treats an open-ended block as overlapping everything after it starts', () => {
    expect(overlaps(span('2026-08-01T00:00:00Z', null), view)).toBe(true);
    expect(overlaps(span('2026-09-01T00:00:00Z', null), view)).toBe(false);
  });
});

describe('contains', () => {
  const day = span('2026-08-10T00:00:00Z', '2026-08-11T00:00:00Z');

  it('includes the start instant', () => {
    expect(contains(day, at('2026-08-10T00:00:00Z'))).toBe(true);
  });

  it('excludes the end instant', () => {
    expect(contains(day, at('2026-08-11T00:00:00Z'))).toBe(false);
  });

  it('an open-ended period contains anything after its start', () => {
    expect(contains(span('2026-08-10T00:00:00Z', null), at('2030-01-01T00:00:00Z'))).toBe(true);
  });
});

describe('comparableToScale', () => {
  it('accepts a block the size of its own scale', () => {
    expect(comparableToScale(span('2026-08-10T00:00:00Z', '2026-08-17T00:00:00Z'), WEEK_MS)).toBe(
      true,
    );
  });

  // The cross-system case the tolerance exists for: a naŭ is 9 days against a
  // week's 7, a factor of 1.28, and the two should read as the same kind of
  // division rather than as a week and something larger.
  it('accepts a naŭ-sized block in a week-scaled view', () => {
    expect(comparableToScale(span('2026-08-10T00:00:00Z', '2026-08-19T00:00:00Z'), WEEK_MS)).toBe(
      true,
    );
  });

  it('rejects a month-sized block in a week-scaled view', () => {
    expect(comparableToScale(span('2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z'), WEEK_MS)).toBe(
      false,
    );
  });

  it('rejects a week-sized block in a day-scaled view', () => {
    expect(comparableToScale(span('2026-08-10T00:00:00Z', '2026-08-17T00:00:00Z'), DAY_MS)).toBe(
      false,
    );
  });

  // An appointment occupies hours and is placed at day scale, which is the
  // smallest Gregorian shows. It must still appear there.
  it('accepts an hours-long appointment in a day-scaled view', () => {
    expect(comparableToScale(span('2026-08-10T09:00:00Z', '2026-08-10T10:30:00Z'), DAY_MS)).toBe(
      true,
    );
  });

  it('never considers an open-ended block comparable to a bounded scale', () => {
    expect(comparableToScale(span('2026-08-10T00:00:00Z', null), MONTH_MS)).toBe(false);
  });

  it('honours the documented tolerance boundary', () => {
    const exactlyAtLimit = span('2026-08-10T00:00:00Z', '2026-08-20T12:00:00Z');
    expect(durationMs(exactlyAtLimit)).toBe(WEEK_MS * SCALE_TOLERANCE);
    expect(comparableToScale(exactlyAtLimit, WEEK_MS)).toBe(true);
  });
});

describe('visibleIn', () => {
  const weekView = span('2026-08-10T00:00:00Z', '2026-08-17T00:00:00Z');

  it('shows a block placed in this week', () => {
    expect(visibleIn(span('2026-08-10T00:00:00Z', '2026-08-17T00:00:00Z'), weekView, WEEK_MS)).toBe(
      true,
    );
  });

  // The bug the old `granularityOf` thresholds produced: a block spanning all of
  // August appearing on every single day of August. It overlaps the view, but it
  // was not placed at this scale.
  it('hides a month-long block from a week view even though it overlaps', () => {
    const august = span('2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z');
    expect(overlaps(august, weekView)).toBe(true);
    expect(visibleIn(august, weekView, WEEK_MS)).toBe(false);
  });

  it('hides a same-sized block that falls outside the view', () => {
    expect(visibleIn(span('2026-09-01T00:00:00Z', '2026-09-08T00:00:00Z'), weekView, WEEK_MS)).toBe(
      false,
    );
  });

  it('shows a naŭ-planned block inside a Gregorian week view', () => {
    const nau = span('2026-08-10T00:00:00Z', '2026-08-19T00:00:00Z');
    expect(visibleIn(nau, weekView, WEEK_MS)).toBe(true);
  });

  it('shows a Gregorian week inside a naŭ view', () => {
    const nauView = span('2026-08-10T00:00:00Z', '2026-08-19T00:00:00Z');
    const week = span('2026-08-10T00:00:00Z', '2026-08-17T00:00:00Z');
    expect(visibleIn(week, nauView, NAU_MS)).toBe(true);
  });
});
