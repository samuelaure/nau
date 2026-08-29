import type { Instant, Interval } from './contract';

/**
 * Arithmetic on stretches of the timeline.
 *
 * The only vocabulary every time system shares. A Gregorian month, a naŭ, a
 * lunation and "the trip to Mexico" have nothing in common except that they
 * occupy the same physical time — so comparing them means comparing instants,
 * and nothing else. Any function here that needed to know which system an
 * interval came from would be a leak.
 *
 * Intervals are half-open, `[start, end)`. See `Interval` for why.
 */

/** How long an interval lasts. Infinite for one with no known end. */
export function durationMs(interval: Interval): number {
  if (interval.end === null) return Number.POSITIVE_INFINITY;
  return interval.end.getTime() - interval.start.getTime();
}

/**
 * Whether two stretches share any time at all.
 *
 * Covers all four arrangements, containment included — a block spanning the
 * whole of September overlaps a view of one week inside it, even though neither
 * of its ends falls within that week. Testing only whether an end lands inside
 * the window misses exactly that case.
 *
 * Whether such a block should be *shown* is a separate question, answered by
 * `comparableToScale` below. Keeping the two apart means each does its own job:
 * this one is about time, that one is about intent.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  const aEndsBeforeB = a.end !== null && a.end.getTime() <= b.start.getTime();
  if (aEndsBeforeB) return false;

  const bEndsBeforeA = b.end !== null && b.end.getTime() <= a.start.getTime();
  if (bEndsBeforeA) return false;

  return true;
}

/** Whether an instant falls inside the interval. Half-open: the end is excluded. */
export function contains(interval: Interval, at: Instant): boolean {
  if (at.getTime() < interval.start.getTime()) return false;
  if (interval.end === null) return true;
  return at.getTime() < interval.end.getTime();
}

/**
 * How much slack is allowed when deciding two scales are the same size.
 *
 * A chosen number, not a derived one, and deliberately in exactly one place:
 * a naŭ runs 9 days against a Gregorian week's 7, and the two should read as
 * the same kind of division rather than as a week and something bigger. 1.5
 * admits that pairing and still refuses a month against a week.
 *
 * It is applied to the *typical duration of a scale*, never to the duration of
 * an individual block, so it is one decision about vocabulary rather than a
 * threshold each item gets measured against.
 */
export const SCALE_TOLERANCE = 1.5;

/**
 * Whether something that occupies `interval` belongs in a view of this scale.
 *
 * This is the second half of cross-system translation, and it rests on a
 * property of how planning works: a block's interval does not describe how long
 * the work takes, it names the period the block was placed in. Deferring
 * something to "this week" on a Thursday stores Sunday-to-Saturday, not
 * Thursday-to-Saturday. Move it to the month and the interval is rewritten.
 *
 * So comparing durations here is not guessing at intent from the width of a
 * bar: it is comparing the size of two periods. A block placed in a month is
 * about thirty days wide and does not belong in a view of a single naŭ, which
 * is what stops a task spanning all of August from appearing on all thirty-one
 * days of it.
 *
 * An open-ended block is infinite and so is never comparable to a bounded
 * scale, which is the right answer: a period that runs until someone closes it
 * is not a thing to draw inside one day.
 */
export function comparableToScale(
  interval: Interval,
  scaleTypicalMs: number,
  tolerance: number = SCALE_TOLERANCE,
): boolean {
  return durationMs(interval) <= scaleTypicalMs * tolerance;
}

/**
 * Whether something planned in one system should appear in another's view.
 *
 * The whole of cross-system translation, and the reason it can stay this small:
 * systems are compared by the time they occupy and never by interpreting each
 * other's divisions. The moment Gregorian tried to read a lunar interval as
 * "roughly a month", the isolation between systems would be gone.
 */
export function visibleIn(
  block: Interval,
  view: Interval,
  viewScaleTypicalMs: number,
  tolerance: number = SCALE_TOLERANCE,
): boolean {
  return overlaps(block, view) && comparableToScale(block, viewScaleTypicalMs, tolerance);
}
