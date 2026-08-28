import type { Scale, ScaleId } from '../../core/contract';

/**
 * How the Gregorian calendar divides time.
 *
 * These ids belong to this system and nowhere else. A `month` here is not the
 * same scale as a month in the naŭ calendar, and the pair `{system, scale}` is
 * what keeps the two from being confused.
 *
 * Day is the finest scale shown. Hours exist — an appointment runs 09:00 to
 * 10:30 — but they are placed *at* day scale rather than being a scale of their
 * own, because a day is the smallest division a person plans against here.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const GREGORIAN_SCALES = {
  day: 'day',
  week: 'week',
  month: 'month',
  quarter: 'quarter',
  year: 'year',
} as const;

export type GregorianScaleId = (typeof GREGORIAN_SCALES)[keyof typeof GREGORIAN_SCALES];

/**
 * Typical durations, for comparing scales across systems.
 *
 * Approximations on purpose — a month is 28 to 31 days and a year is sometimes
 * 366. They are never used to compute a boundary; that is what `periodAt` does
 * with real calendar arithmetic. Their only job is letting a naŭ (9 days) be
 * recognised as the same kind of division as a week (7 days).
 */
export const scales: readonly Scale[] = [
  { id: 'day', name: 'Día', typicalMs: DAY },
  // No parent. A week crosses month boundaries, so it nests in nothing — the
  // first proof, inside the simplest system, that `Scale.parent` must be
  // optional rather than assumed.
  { id: 'week', name: 'Semana', typicalMs: 7 * DAY },
  { id: 'month', name: 'Mes', typicalMs: 30 * DAY, parent: 'quarter' },
  { id: 'quarter', name: 'Trimestre', typicalMs: 91 * DAY, parent: 'year' },
  { id: 'year', name: 'Año', typicalMs: 365 * DAY },
];

export function isGregorianScale(scale: ScaleId): scale is GregorianScaleId {
  return scales.some((s) => s.id === scale);
}

export function findScale(scale: ScaleId): Scale | null {
  return scales.find((s) => s.id === scale) ?? null;
}
